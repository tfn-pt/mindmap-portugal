from __future__ import annotations

import json
import os
import time
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from shutil import copy2
from tempfile import NamedTemporaryFile
from typing import Iterable, Literal, Mapping
from urllib.parse import quote_plus

import requests
from dotenv import load_dotenv
from loguru import logger
from tenacity import RetryCallState, retry, stop_after_attempt, wait_exponential

from src.utils.hashing import compute_md5

# Ref: PRD 1.1 - Estrutura portável para Streamlit Cloud e ficheiros relativos.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
BACKUP_DATA_DIR = RAW_DATA_DIR / "backup"
TRENDS_BACKUP_DIR = RAW_DATA_DIR / "trends_backup"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
MANIFEST_PATH = DATA_DIR / "manifest.json"

load_dotenv()

# Ref: PRD 1.2 - Cabeçalhos conservadores para fontes públicas com proteção anti-bot.
DEFAULT_HTTP_HEADERS: dict[str, str] = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
}

# Ref: PRD 2.4 - Configuração base do Google Trends. Estes termos devem ser
# sincronizados com o PRD se a equipa alterar a taxonomia analítica.
DEFAULT_GOOGLE_TRENDS_KEYWORDS: tuple[str, ...] = (
    "depressao",
    "ansiedade",
    "saude mental",
)

SourceHandler = Literal["http", "google_trends"]


class FetchError(RuntimeError):
    """Raised when a source cannot be recovered from either origin."""


class ManifestError(RuntimeError):
    """Raised when manifest.json is malformed."""


class MD5MismatchError(FetchError):
    """Raised when a file fails integrity validation."""


@dataclass(frozen=True, slots=True)
class ManifestEntry:
    """Represent a lineage record stored in ``manifest.json``.

    Attributes:
        filename: Raw filename persisted in ``data/raw``.
        md5_hash: Cryptographic digest of the exact bytes stored locally.
        fetched_at: UTC ISO-8601 timestamp for the fetch event that produced the file.
        source_url: Canonical lineage reference for the bytes that were accepted.
    """

    filename: str
    md5_hash: str
    fetched_at: str
    source_url: str


@dataclass(frozen=True, slots=True)
class SourceConfig:
    """Describe a raw-data source and the strategy required to fetch it.

    Attributes:
        key: Stable catalog identifier used by orchestration code.
        filename: Target filename inside ``data/raw``.
        source_url: Primary official URL or API endpoint.
        handler: Fetch strategy name.
        expected_md5: Optional integrity contract supplied by the team or PRD.
        backup_filename: Optional backup filename when it differs from ``filename``.
        backup_subdir: Relative backup folder below ``data/raw``.
        timeout_seconds: HTTP timeout or request budget per attempt.
        request_headers: Extra HTTP headers for official public endpoints.
        google_trends_keywords: Ordered keywords for ``pytrends`` requests.
        google_trends_geo: Geo code used by Google Trends.
        google_trends_timeframe: Google Trends timeframe expression.
        notes: Human-readable documentation for analysts reading the source catalog.
    """

    key: str
    filename: str
    source_url: str
    handler: SourceHandler = "http"
    expected_md5: str | None = None
    backup_filename: str | None = None
    backup_subdir: str = "backup"
    timeout_seconds: float = 45.0
    request_headers: Mapping[str, str] = field(
        default_factory=lambda: dict(DEFAULT_HTTP_HEADERS)
    )
    google_trends_keywords: tuple[str, ...] = field(default_factory=tuple)
    google_trends_geo: str = "PT"
    google_trends_timeframe: str = "today 5-y"
    notes: str = ""

    @property
    def backup_name(self) -> str:
        """Return the filename expected inside the backup folder."""
        return self.backup_filename or self.filename

    @property
    def backup_directory(self) -> Path:
        """Return the absolute backup directory for this source."""
        return RAW_DATA_DIR / self.backup_subdir


def _build_sns_request_headers(sns_api_key: str | None) -> dict[str, str]:
    """Build SNS request headers while keeping the public endpoint compatible.

    Args:
        sns_api_key: API key loaded from the environment or `.env`.

    Returns:
        Dictionary of HTTP headers to attach to SNS requests.
    """
    headers = dict(DEFAULT_HTTP_HEADERS)
    if sns_api_key:
        headers["X-API-Key"] = sns_api_key
    return headers


def build_default_source_catalog() -> dict[str, SourceConfig]:
    """Build the project source catalog.

    Returns:
        Dictionary keyed by stable source identifiers.

    Notes:
        # Ref: PRD 2.1 - Catálogo explícito e auditável das fontes.
        The catalog intentionally keeps source metadata close to the fetch logic so
        that students can inspect one file and understand both provenance and code.

        This catalog intentionally excludes INE and PORDATA HTML pages. Those
        attempts produced non-analytical HTML artifacts and were removed from the
        extraction pipeline during the audit cleanup phase.
        """
    # Ref: PRD 2.1.3 - DGS.
    dgs_notes = (
        "Official DGS publication page for 'Portugal - Saude Mental em Numeros 2015'. "
        "The DGS publications page still lists the 2015 edition as the most recent "
        "mental-health-in-numbers report, published on 2016-03-23."
    )

    # Ref: PRD 2.1.4 - Eurostat.
    eurostat_notes = (
        "Official Eurostat dissemination API endpoint for dataset hlth_sha11_hf. "
        "The endpoint is intentionally kept as JSON because it is already a machine-"
        "readable API source."
    )

    # Ref: PRD 2.1.5 - Google Trends.
    trends_notes = (
        "Google Trends acquisition via pytrends using PT geography and a five-year "
        "window. Replace keywords if the PRD taxonomy changes."
    )

    sns_api_key = os.getenv("SNS_API_KEY")
    sns_headers = _build_sns_request_headers(sns_api_key)

    return {
        "dgs_saude_mental_numeros": SourceConfig(
            key="dgs_saude_mental_numeros",
            filename="dgs_saude_mental_em_numeros_2015.pdf",
            source_url=(
                "https://www.dgs.pt/estatisticas-de-saude/estatisticas-de-saude/"
                "publicacoes/portugal-saude-mental-em-numeros-2015-pdf.aspx"
            ),
            handler="http",
            notes=dgs_notes,
        ),
        "eurostat_hlth_sha11_hf": SourceConfig(
            key="eurostat_hlth_sha11_hf",
            filename="eurostat_hlth_sha11_hf_pt.json",
            source_url=(
                "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/"
                "data/hlth_sha11_hf?lang=en&geo=PT"
            ),
            handler="http",
            notes=eurostat_notes,
        ),
        "google_trends_saude_mental": SourceConfig(
            key="google_trends_saude_mental",
            filename="google_trends_saude_mental_pt.csv",
            source_url="https://trends.google.com/trends/",
            handler="google_trends",
            backup_subdir="trends_backup",
            google_trends_keywords=DEFAULT_GOOGLE_TRENDS_KEYWORDS,
            google_trends_geo="PT",
            google_trends_timeframe="today 5-y",
            notes=trends_notes,
        ),
        "sns_consultas": SourceConfig(
            key="sns_consultas",
            filename="sns_consultas.json",
            source_url=(
                "https://transparencia.sns.gov.pt/api/explore/v2.1/catalog/"
                "datasets/evolucao-mensal-das-consultas-de-psicologia/exports/json"
                "?lang=pt&timezone=Europe%2FLisbon"
            ),
            handler="http",
            request_headers=sns_headers,
            notes=(
                "SNS Transparencia v2.1 JSON export for monthly psychology consultations. "
                "The pipeline loads SNS_API_KEY from .env when available and attaches it "
                "to the request headers without making the key mandatory for public access."
            ),
        ),
        "sns_capic": SourceConfig(
            key="sns_capic",
            filename="sns_capic.json",
            source_url=(
                "https://transparencia.sns.gov.pt/api/explore/v2.1/catalog/"
                "datasets/chamadas-capic/exports/json?lang=pt&timezone=Europe%2FLisbon"
            ),
            handler="http",
            request_headers=sns_headers,
            notes=(
                "SNS Transparencia v2.1 JSON export for CAPIC calls. "
                "The pipeline loads SNS_API_KEY from .env when available and attaches "
                "it to the request headers."
            ),
        ),
    }

DEFAULT_SOURCE_CATALOG = build_default_source_catalog()


def clean_raw_directory(
    raw_dir: Path = RAW_DATA_DIR,
    manifest_path: Path = MANIFEST_PATH,
) -> int:
    """Delete obsolete HTML artifacts from ``data/raw`` and prune the manifest.

    Args:
        raw_dir: Raw directory to clean.
        manifest_path: Manifest to keep aligned with the filesystem.

    Returns:
        int: Number of HTML files removed from ``data/raw``.

    Notes:
        # Ref: PRD Audit 1 - Eliminar permanentemente artefactos HTML inúteis.
    """
    ensure_data_layout(manifest_path=manifest_path, raw_dir=raw_dir)
    manifest = load_manifest(manifest_path)
    html_paths = sorted(raw_dir.glob("*.html"))
    html_manifest_entries = [
        filename for filename in manifest if filename.lower().endswith(".html")
    ]

    for html_path in html_paths:
        html_path.unlink(missing_ok=True)
        manifest.pop(html_path.name, None)

    for filename in html_manifest_entries:
        manifest.pop(filename, None)

    save_manifest(manifest, manifest_path)
    logger.info(
        "Raw directory cleanup removed {} HTML files and pruned {} HTML manifest entries.",
        len(html_paths),
        len(html_manifest_entries),
    )
    return len(html_paths)


def ensure_data_layout(
    manifest_path: Path = MANIFEST_PATH,
    raw_dir: Path = RAW_DATA_DIR,
    processed_dir: Path = PROCESSED_DATA_DIR,
) -> None:
    """Create the expected project folders and an initial manifest template.

    Args:
        manifest_path: Target manifest path.
        raw_dir: Root folder for raw sources.
        processed_dir: Root folder for processed outputs.

    Returns:
        None.

    Notes:
        # Ref: PRD 1.1 - Relative paths for Streamlit Cloud deployment.
    """
    raw_dir.mkdir(parents=True, exist_ok=True)
    (raw_dir / "backup").mkdir(parents=True, exist_ok=True)
    (raw_dir / "dgs_manual").mkdir(parents=True, exist_ok=True)
    (raw_dir / "trends_backup").mkdir(parents=True, exist_ok=True)
    processed_dir.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    if not manifest_path.exists():
        manifest_path.write_text(
            json.dumps({"files": []}, indent=2, ensure_ascii=True) + "\n",
            encoding="utf-8",
        )


def load_manifest(manifest_path: Path = MANIFEST_PATH) -> dict[str, ManifestEntry]:
    """Load ``manifest.json`` as the single lineage authority.

    Args:
        manifest_path: Manifest location.

    Returns:
        Dictionary keyed by filename.

    Raises:
        ManifestError: If the JSON payload is malformed.

    Notes:
        # Ref: PRD 3.2 - manifest.json como única fonte de verdade.
    """
    ensure_data_layout(manifest_path=manifest_path)

    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ManifestError(f"Invalid JSON in manifest: {manifest_path}") from exc

    files = payload.get("files", [])
    if not isinstance(files, list):
        raise ManifestError("manifest.json must contain a top-level 'files' list.")

    entries: dict[str, ManifestEntry] = {}
    for item in files:
        if not isinstance(item, dict):
            raise ManifestError("Each manifest entry must be an object.")

        entry = ManifestEntry(
            filename=str(item["filename"]),
            md5_hash=str(item["md5_hash"]).lower(),
            fetched_at=str(item["fetched_at"]),
            source_url=str(item["source_url"]),
        )
        entries[entry.filename] = entry

    return entries


def save_manifest(
    entries: Mapping[str, ManifestEntry],
    manifest_path: Path = MANIFEST_PATH,
) -> None:
    """Persist lineage entries to ``manifest.json``.

    Args:
        entries: Mapping of filename to manifest entry.
        manifest_path: Destination manifest path.

    Returns:
        None.
    """
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    ordered_entries = [asdict(entries[filename]) for filename in sorted(entries.keys())]
    manifest_path.write_text(
        json.dumps({"files": ordered_entries}, indent=2, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )


def fetch_sources(
    sources: Iterable[SourceConfig],
    manifest_path: Path = MANIFEST_PATH,
    raw_dir: Path = RAW_DATA_DIR,
) -> list[Path]:
    """Fetch a collection of configured sources.

    Args:
        sources: Iterable of source configurations.
        manifest_path: Manifest path to update.
        raw_dir: Raw output directory.

    Returns:
        List of resolved file paths in fetch order.
    """
    return [
        fetch_with_fallback(source=source, manifest_path=manifest_path, raw_dir=raw_dir)
        for source in sources
    ]


def fetch_default_sources(
    manifest_path: Path = MANIFEST_PATH,
    raw_dir: Path = RAW_DATA_DIR,
) -> dict[str, Path]:
    """Fetch the built-in source catalog.

    Args:
        manifest_path: Manifest path to update.
        raw_dir: Raw output directory.

    Returns:
        Mapping of source key to fetched raw path.
    """
    return {
        key: fetch_with_fallback(source, manifest_path=manifest_path, raw_dir=raw_dir)
        for key, source in DEFAULT_SOURCE_CATALOG.items()
    }


def run_fetch_pipeline(
    manifest_path: Path = MANIFEST_PATH,
    raw_dir: Path = RAW_DATA_DIR,
    processed_dir: Path = PROCESSED_DATA_DIR,
) -> dict[str, Path]:
    """Run the full extraction pipeline for the built-in source catalog.

    Args:
        manifest_path: Manifest path to update.
        raw_dir: Raw data directory.
        processed_dir: Processed data directory.

    Returns:
        Mapping of source keys to fetched file paths.
    """
    Path("data/raw").mkdir(parents=True, exist_ok=True)
    Path("data/processed").mkdir(parents=True, exist_ok=True)
    Path("data/raw/dgs_manual").mkdir(parents=True, exist_ok=True)
    Path("data/raw/trends_backup").mkdir(parents=True, exist_ok=True)

    ensure_data_layout(
        manifest_path=manifest_path,
        raw_dir=raw_dir,
        processed_dir=processed_dir,
    )
    clean_raw_directory(raw_dir=raw_dir, manifest_path=manifest_path)
    (raw_dir / "dgs_manual").mkdir(parents=True, exist_ok=True)
    (raw_dir / "trends_backup").mkdir(parents=True, exist_ok=True)
    logger.info(
        "SNS API key {} carregada a partir do ambiente.",
        "foi" if os.getenv("SNS_API_KEY") else "nao foi",
    )

    fetched = fetch_default_sources(manifest_path=manifest_path, raw_dir=raw_dir)
    logger.info(
        "Extraction pipeline completed with {} fetched sources.",
        len(fetched),
    )
    return fetched


def fetch_with_fallback(
    source: SourceConfig,
    manifest_path: Path = MANIFEST_PATH,
    raw_dir: Path = RAW_DATA_DIR,
) -> Path:
    """Fetch one source, validate integrity, and fall back to a local backup.

    Args:
        source: Source configuration to fetch.
        manifest_path: Manifest path to update.
        raw_dir: Raw output directory.

    Returns:
        Path to the accepted raw file.

    Raises:
        FetchError: If neither the primary source nor the backup can be accepted.
        MD5MismatchError: If the recovered bytes fail integrity validation.

    Notes:
        # Ref: PRD 2.2 - Manifest-first lineage.
        # Ref: PRD 2.3 - Retry and fallback workflow.
    """
    ensure_data_layout(manifest_path=manifest_path, raw_dir=raw_dir)
    manifest = load_manifest(manifest_path)
    destination = raw_dir / source.filename
    backup_dir = raw_dir / source.backup_subdir
    manifest_entry = manifest.get(source.filename)

    local_hash = _maybe_skip_download(destination, source, manifest_entry)
    if local_hash is not None:
        preserved_source_url = (
            manifest_entry.source_url if manifest_entry is not None else source.source_url
        )
        preserved_fetched_at = (
            manifest_entry.fetched_at
            if manifest_entry is not None
            else _timestamp_from_mtime(destination)
        )
        manifest[source.filename] = ManifestEntry(
            filename=source.filename,
            md5_hash=local_hash,
            fetched_at=preserved_fetched_at,
            source_url=preserved_source_url,
        )
        save_manifest(manifest, manifest_path)
        logger.info(
            "Download skipped for {} because the local bytes already match the manifest.",
            source.filename,
        )
        return destination

    try:
        downloaded_path = _fetch_primary_source(source, destination)
        try:
            digest = _validate_md5(
                file_path=downloaded_path,
                expected_md5=source.expected_md5,
                filename=source.filename,
                origin=_build_lineage_reference(source),
            )
        except MD5MismatchError:
            downloaded_path.unlink(missing_ok=True)
            raise

        manifest[source.filename] = _build_manifest_entry(
            source=source,
            md5_hash=digest,
            manifest_entry=manifest_entry,
            source_reference=_build_lineage_reference(source),
        )
        save_manifest(manifest, manifest_path)
        logger.info("Download completed for {}.", source.filename)
        return downloaded_path
    except Exception as primary_exc:
        logger.warning(
            "Primary source failed for {}. Trying backup at {}. Cause: {}",
            source.filename,
            _relative_to_project(backup_dir / source.backup_name),
            primary_exc,
        )

        try:
            recovered_path = _restore_from_backup(
                source=source,
                destination=destination,
                backup_dir=backup_dir,
            )
            digest = _validate_md5(
                file_path=recovered_path,
                expected_md5=source.expected_md5,
                filename=source.filename,
                origin=_relative_to_project(backup_dir / source.backup_name),
            )
        except Exception as backup_exc:
            logger.critical(
                "Both primary and backup sources failed for {}. Primary: {}. Backup: {}",
                source.filename,
                primary_exc,
                backup_exc,
            )
            raise FetchError(
                f"Failed to fetch {source.filename} from primary URL and backup."
            ) from backup_exc

        manifest[source.filename] = _build_manifest_entry(
            source=source,
            md5_hash=digest,
            manifest_entry=manifest_entry,
            source_reference=_relative_to_project(backup_dir / source.backup_name),
        )
        save_manifest(manifest, manifest_path)
        logger.warning(
            "Primary source failed for {}. Using backup at {}.",
            source.filename,
            _relative_to_project(backup_dir / source.backup_name),
        )
        return recovered_path


def _maybe_skip_download(
    destination: Path,
    source: SourceConfig,
    manifest_entry: ManifestEntry | None,
) -> str | None:
    """Return the current MD5 when the local raw file is already trustworthy.

    Args:
        destination: Local raw path.
        source: Source configuration being fetched.
        manifest_entry: Existing lineage entry for the file, if any.

    Returns:
        The current local MD5 when the file can be reused, otherwise ``None``.

    Notes:
        # Ref: PRD 3.1 - Evitar tráfego desnecessário.
        # Ref: PRD 3.3 - Guardrail de MD5.

        Why verify the hash before processing?
        Because downstream feature engineering should only run on bytes whose origin
        and integrity are already known. If the raw bytes changed silently, every
        processed derivative becomes harder to reproduce and debug. The hash check is
        therefore a cheap early-warning system that protects the whole pipeline.
    """
    if not destination.exists():
        return None

    current_hash = compute_md5(destination)
    expected_md5 = source.expected_md5.lower() if source.expected_md5 else None
    manifest_md5 = manifest_entry.md5_hash.lower() if manifest_entry else None

    if manifest_md5 and current_hash == manifest_md5:
        return current_hash

    if expected_md5 and current_hash == expected_md5:
        return current_hash

    if expected_md5 and current_hash != expected_md5:
        logger.critical(
            "Hash mismatch for existing file {}. Expected {}, got {}.",
            source.filename,
            expected_md5,
            current_hash,
        )
    elif manifest_md5 and current_hash != manifest_md5:
        logger.critical(
            "Hash drift detected for existing file {}. Manifest has {}, local file has {}.",
            source.filename,
            manifest_md5,
            current_hash,
        )

    return None


def _build_manifest_entry(
    source: SourceConfig,
    md5_hash: str,
    source_reference: str,
    manifest_entry: ManifestEntry | None,
) -> ManifestEntry:
    """Create the manifest entry that will become the new lineage truth.

    Args:
        source: Source configuration being persisted.
        md5_hash: Accepted MD5 digest.
        source_reference: Canonical lineage reference for the accepted bytes.
        manifest_entry: Existing manifest entry, if present.

    Returns:
        New manifest entry.
    """
    normalized_hash = md5_hash.lower()
    if manifest_entry is not None and manifest_entry.md5_hash.lower() != normalized_hash:
        logger.warning(
            "Source {} changed hash from {} to {}. Updating manifest explicitly.",
            source.filename,
            manifest_entry.md5_hash.lower(),
            normalized_hash,
        )

    return ManifestEntry(
        filename=source.filename,
        md5_hash=normalized_hash,
        fetched_at=_timestamp_now(),
        source_url=source_reference,
    )


def _timestamp_now() -> str:
    """Return the current UTC timestamp in ISO-8601 format."""
    return datetime.now(UTC).isoformat()


def _timestamp_from_mtime(file_path: Path) -> str:
    """Return a file modification time as an ISO-8601 UTC timestamp."""
    return datetime.fromtimestamp(file_path.stat().st_mtime, tz=UTC).isoformat()


def _validate_md5(
    file_path: Path,
    expected_md5: str | None,
    filename: str,
    origin: str,
) -> str:
    """Validate a file digest against the configured expectation.

    Args:
        file_path: File to validate.
        expected_md5: Expected digest, when one exists.
        filename: Human-readable filename for logging.
        origin: Source reference used in logs.

    Returns:
        Observed MD5 digest.

    Raises:
        MD5MismatchError: If the digest does not match the configured expectation.

    Notes:
        # Ref: PRD 3.3 - Nunca processar bytes com hash inesperado.
    """
    digest = compute_md5(file_path)
    if expected_md5 is None:
        return digest

    normalized_expected = expected_md5.lower()
    if digest != normalized_expected:
        logger.critical(
            "Hash mismatch for {} from {}. Expected {}, got {}.",
            filename,
            origin,
            normalized_expected,
            digest,
        )
        raise MD5MismatchError(
            f"Integrity validation failed for {filename}: {digest} != {normalized_expected}"
        )

    return digest


def _restore_from_backup(
    source: SourceConfig,
    destination: Path,
    backup_dir: Path,
) -> Path:
    """Copy a backup file into ``data/raw`` for a failed source.

    Args:
        source: Source configuration being recovered.
        destination: Final raw path.
        backup_dir: Backup directory for the source.

    Returns:
        Destination path after restore.

    Raises:
        FileNotFoundError: If the configured backup file does not exist.
    """
    backup_path = backup_dir / source.backup_name
    if not backup_path.exists():
        raise FileNotFoundError(
            f"Backup file not found for {source.filename}: {backup_path}"
        )

    destination.parent.mkdir(parents=True, exist_ok=True)
    copy2(backup_path, destination)
    return destination


def _build_lineage_reference(source: SourceConfig) -> str:
    """Build the lineage reference stored in the manifest.

    Args:
        source: Source configuration.

    Returns:
        Canonical lineage reference.
    """
    if source.handler != "google_trends":
        return source.source_url

    encoded_terms = ",".join(quote_plus(term) for term in source.google_trends_keywords)
    return (
        "https://trends.google.com/trends/explore"
        f"?geo={quote_plus(source.google_trends_geo)}"
        f"&q={encoded_terms}"
        f"&date={quote_plus(source.google_trends_timeframe)}"
    )


def _relative_to_project(path: Path) -> str:
    """Render a project-relative path when possible, else an absolute path."""
    resolved_path = path.resolve()
    try:
        return resolved_path.relative_to(PROJECT_ROOT).as_posix()
    except ValueError:
        return resolved_path.as_posix()


def _log_retry_attempt(retry_state: RetryCallState) -> None:
    """Emit a warning before a retry sleep.

    Args:
        retry_state: Tenacity retry state.

    Returns:
        None.
    """
    url = retry_state.args[0] if retry_state.args else "<unknown>"
    exception = retry_state.outcome.exception() if retry_state.outcome else None
    logger.warning(
        "Retrying download for {} (attempt {}/3). Cause: {}",
        url,
        retry_state.attempt_number,
        exception,
    )


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    before_sleep=_log_retry_attempt,
    reraise=True,
)
def _download_file(
    url: str,
    destination: Path,
    timeout_seconds: float,
    headers: Mapping[str, str],
) -> None:
    """Download an HTTP resource into a temporary file.

    Args:
        url: Primary URL to fetch.
        destination: Temporary file path.
        timeout_seconds: Request timeout.
        headers: HTTP headers to send.

    Returns:
        None.
    """
    with requests.get(url, stream=True, timeout=timeout_seconds, headers=dict(headers)) as response:
        response.raise_for_status()
        with destination.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    handle.write(chunk)


def _fetch_primary_source(source: SourceConfig, destination: Path) -> Path:
    """Dispatch to the correct primary fetch handler for a source.

    Args:
        source: Source configuration.
        destination: Final raw destination.

    Returns:
        Accepted destination path.

    Raises:
        FetchError: If the handler name is unsupported.
    """
    if source.handler == "http":
        return _download_primary_http_source(source, destination)
    if source.handler == "google_trends":
        return _download_google_trends_source(source, destination)

    raise FetchError(f"Unsupported handler '{source.handler}' for {source.key}.")


def _download_primary_http_source(source: SourceConfig, destination: Path) -> Path:
    """Download a conventional HTTP source.

    Args:
        source: Source configuration.
        destination: Final raw destination.

    Returns:
        Destination path.
    """
    destination.parent.mkdir(parents=True, exist_ok=True)

    temporary_path: Path | None = None
    try:
        with NamedTemporaryFile(
            dir=destination.parent,
            prefix=f"{destination.stem}-",
            suffix=f"{destination.suffix}.tmp",
            delete=False,
        ) as handle:
            temporary_path = Path(handle.name)

        _download_file(
            source.source_url,
            temporary_path,
            source.timeout_seconds,
            source.request_headers,
        )
        temporary_path.replace(destination)
        return destination
    except Exception:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink(missing_ok=True)
        raise


def _download_google_trends_source(source: SourceConfig, destination: Path) -> Path:
    """Download Google Trends interest-over-time data as CSV.

    Args:
        source: Google Trends source configuration.
        destination: Final CSV path inside ``data/raw``.

    Returns:
        Destination path.

    Raises:
        FetchError: If the source is misconfigured or pytrends returns no data.

    Notes:
        # Ref: PRD 2.4 - Usar pytrends com ``time.sleep(1)`` entre requests.
    """
    if not source.google_trends_keywords:
        raise FetchError(
            f"Google Trends source '{source.key}' requires at least one keyword."
        )

    try:
        from pytrends.request import TrendReq
    except ImportError as exc:
        raise FetchError(
            "pytrends is required for Google Trends ingestion. Add it to requirements."
        ) from exc

    destination.parent.mkdir(parents=True, exist_ok=True)

    temporary_path: Path | None = None
    try:
        with NamedTemporaryFile(
            dir=destination.parent,
            prefix=f"{destination.stem}-",
            suffix=".tmp",
            delete=False,
        ) as handle:
            temporary_path = Path(handle.name)

        pytrends = TrendReq(hl="pt-PT", tz=0)
        pytrends.build_payload(
            list(source.google_trends_keywords),
            cat=0,
            timeframe=source.google_trends_timeframe,
            geo=source.google_trends_geo,
        )
        time.sleep(1.0)
        interest_over_time = pytrends.interest_over_time()
        time.sleep(1.0)

        if interest_over_time.empty:
            raise FetchError(
                f"Google Trends returned an empty dataset for source '{source.key}'."
            )

        if "isPartial" in interest_over_time.columns:
            interest_over_time = interest_over_time.drop(columns=["isPartial"])

        interest_over_time.to_csv(temporary_path, encoding="utf-8")
        temporary_path.replace(destination)
        return destination
    except Exception:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink(missing_ok=True)
        raise


__all__ = [
    "BACKUP_DATA_DIR",
    "DATA_DIR",
    "DEFAULT_GOOGLE_TRENDS_KEYWORDS",
    "DEFAULT_SOURCE_CATALOG",
    "FetchError",
    "MANIFEST_PATH",
    "ManifestEntry",
    "MD5MismatchError",
    "PROCESSED_DATA_DIR",
    "PROJECT_ROOT",
    "RAW_DATA_DIR",
    "SourceConfig",
    "TRENDS_BACKUP_DIR",
    "build_default_source_catalog",
    "clean_raw_directory",
    "ensure_data_layout",
    "fetch_default_sources",
    "fetch_sources",
    "fetch_with_fallback",
    "load_manifest",
    "run_fetch_pipeline",
    "save_manifest",
]

if __name__ == "__main__":
    logger.info("A iniciar o pipeline de extração de dados...")
    try:
        results = run_fetch_pipeline()
        logger.info(
            "Pipeline executado com sucesso. Ficheiros obtidos: {}",
            {key: _relative_to_project(path) for key, path in results.items()},
        )
    except Exception as e:
        logger.exception("Falha fatal no pipeline:")
        raise
