from __future__ import annotations

import json
import re
import shutil
from pathlib import Path
from typing import Any

import pandas as pd
import pdfplumber
from loguru import logger

from src.data.fetcher import PROCESSED_DATA_DIR, RAW_DATA_DIR

INE_ICOR_PATH = RAW_DATA_DIR / "ine_icor_2023.csv"
SNS_CONSULTAS_PATH = RAW_DATA_DIR / "sns_consultas.json"
SNS_CAPIC_PATH = RAW_DATA_DIR / "sns_capic.json"
EUROSTAT_PATH = RAW_DATA_DIR / "eurostat_hlth_sha11_hf_pt.json"
GOOGLE_TRENDS_PATH = RAW_DATA_DIR / "google_trends_saude_mental_pt.csv"
INFOESCOLAS_PATH = RAW_DATA_DIR / "InfoEscolas2024_Secundario_CH_DadosPorRegiao.xlsx"
DASHBOARD_MAIN_PATH = PROCESSED_DATA_DIR / "dashboard_main.parquet"
STUDY_INSIGHTS_PATH = PROCESSED_DATA_DIR / "study_insights.json"
DATA_LINEAGE_PATH = PROCESSED_DATA_DIR / "data_lineage.json"

FINAL_COLUMNS: list[str] = [
    "ano",
    "regiao",
    "consultas_sns",
    "capic_sns",
    "prevalencia_ine",
    "ansiedade_2024_ine",
    "ase_percent_min_educ",
    "retencao_min_educ",
    "google_interest_score",
    "spending_eurostat",
]

REGION_CANONICAL_MAP: dict[str, str] = {
    "regiao de saude norte": "Norte",
    "regiao de saude do centro": "Centro",
    "regiao de saude lvt": "Lisboa e Vale do Tejo",
    "regiao de saude do alentejo": "Alentejo",
    "regiao de saude do algarve": "Algarve",
    "norte": "Norte",
    "centro": "Centro",
    "alentejo": "Alentejo",
    "algarve": "Algarve",
    "oeste e vale do tejo": "Lisboa e Vale do Tejo",
    "grande lisboa": "Lisboa e Vale do Tejo",
    "peninsula de setubal": "Lisboa e Vale do Tejo",
    "lisboa e vale do tejo": "Lisboa e Vale do Tejo",
}


def run_transform_pipeline() -> dict[str, pd.DataFrame]:
    """Run the full Phase 1 sealing pipeline with lineage certification."""
    clean_processed_directory()

    study_insights = extract_study_insights()
    _save_json(STUDY_INSIGHTS_PATH, study_insights)

    consultas_df = transform_sns_consultas()
    capic_df = transform_sns_capic()
    prevalencia_df = transform_ine_prevalencia()
    ansiedade_df = transform_ine_ansiedade_2024()
    ase_df = transform_min_educ_ase()
    retencao_df = transform_min_educ_retencao()
    trends_df = transform_google_interest_score(df_consultas=consultas_df)
    spending_df = transform_spending_eurostat()

    dashboard_df = build_dashboard_main(
        df_consultas=consultas_df,
        df_capic=capic_df,
        df_prevalencia=prevalencia_df,
        df_ansiedade=ansiedade_df,
        df_ase=ase_df,
        df_retencao=retencao_df,
        df_trends=trends_df,
        df_spending=spending_df,
    )

    data_lineage = build_data_lineage()
    assert_source_contract(dashboard_df, data_lineage)

    dashboard_df.to_parquet(DASHBOARD_MAIN_PATH, index=False)
    dashboard_df.to_csv(DASHBOARD_MAIN_PATH.with_suffix(".csv"), index=False, encoding="utf-8")
    _save_json(DATA_LINEAGE_PATH, data_lineage)

    logger.info("Saved dashboard_main dataframe with shape {}.", dashboard_df.shape)
    logger.info("Contrato de Verdade assinado.")

    return {
        "dashboard_main": dashboard_df,
        "study_insights": pd.DataFrame(study_insights),
        "consultas_sns": consultas_df,
        "capic_sns": capic_df,
        "prevalencia_ine": prevalencia_df,
        "ansiedade_2024_ine": ansiedade_df,
        "ase_percent_min_educ": ase_df,
        "retencao_min_educ": retencao_df,
        "google_interest_score": trends_df,
        "spending_eurostat": spending_df,
    }


def clean_processed_directory() -> None:
    """Remove every artifact from ``data/processed`` for a fresh sealed build."""
    PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
    for path in PROCESSED_DATA_DIR.iterdir():
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink(missing_ok=True)
    logger.info("Cleaned processed directory at {}.", PROCESSED_DATA_DIR)


def extract_study_insights() -> list[dict[str, Any]]:
    """Extract auditable PDF insights for downstream reporting."""
    ers_path = _resolve_single_raw_file("estudo_saude_mental_*.pdf")
    ine_pdf_path = _resolve_single_raw_file("04DiaMS*.pdf")

    ers_text = _read_pdf_text(ers_path)
    ine_text = _read_pdf_text(ine_pdf_path)
    ers_text_norm = _normalize_free_text(ers_text)
    ine_text_norm = _normalize_free_text(ine_text)

    _ensure_contains(ers_text_norm, "data: dezembro de 2023", ers_path.name)
    _ensure_contains(
        ers_text_norm,
        "43 entidades hospitalares oferecem consultas de psiquiatria e 39 oferecem consultas de psicologia",
        ers_path.name,
    )
    _ensure_contains(
        ers_text_norm,
        "74% da populacao do territorio de portugal continental ate 30 minutos",
        ers_path.name,
    )
    _ensure_contains(ers_text_norm, "39% dos utentes foram atendidos", ers_path.name)
    _ensure_contains(ers_text_norm, "66 equipas comunitarias", ers_path.name)
    _ensure_contains(
        ers_text_norm,
        "taxa media anual de 5%, e que o numero de consultas de psicologia cresceu",
        ers_path.name,
    )

    _ensure_contains(ine_text_norm, "4 de abril de 2025", ine_pdf_path.name)
    _ensure_contains(
        ine_text_norm,
        "32,0% da populacao com sintomas de ansiedade generalizada em 2024",
        ine_pdf_path.name,
    )
    _ensure_contains(ine_text_norm, "atingiu 28,7% em 2024", ine_pdf_path.name)
    _ensure_contains(
        ine_text_norm,
        "em 2022, a expectativa de vida saudavel aos 65 anos era de 8,6 anos para os homens",
        ine_pdf_path.name,
    )

    return [
        {
            "facto": "Publicacao do estudo da ERS sobre acesso a cuidados de saude mental nos hospitais do SNS",
            "valor": "Dezembro de 2023",
            "fonte": ers_path.name,
            "data_publicacao": "Dezembro de 2023",
        },
        {
            "facto": "Oferta hospitalar de saude mental no SNS",
            "valor": "43 hospitais com consultas de psiquiatria, 39 com consultas de psicologia, 33 com internamento e 22 com urgencias",
            "fonte": ers_path.name,
            "data_publicacao": "Dezembro de 2023",
        },
        {
            "facto": "Cobertura estimada das Redes de Referenciacao Hospitalar",
            "valor": "RRH de adultos: 74% da populacao a 30 minutos e 95% a 60 minutos; RRH da infancia e adolescencia: 71% a 30 minutos e 94% a 60 minutos",
            "fonte": ers_path.name,
            "data_publicacao": "Dezembro de 2023",
        },
        {
            "facto": "Incumprimento dos tempos maximos de resposta garantidos nas consultas hospitalares de psiquiatria",
            "valor": "No 1S2023 houve 21.786 primeiras consultas e 39% excederam o TMRG",
            "fonte": ers_path.name,
            "data_publicacao": "Dezembro de 2023",
        },
        {
            "facto": "Equipas comunitarias de saude mental em operacao",
            "valor": "66 equipas; 22 entidades sem qualquer equipa; 25 entidades com media de 2,6 equipas",
            "fonte": ers_path.name,
            "data_publicacao": "Dezembro de 2023",
        },
        {
            "facto": "Evolucao da atividade hospitalar em saude mental entre 2018 e 2022",
            "valor": "Consultas de psiquiatria +5% ao ano; consultas de psicologia +12% ao ano; internamentos -2% ao ano",
            "fonte": ers_path.name,
            "data_publicacao": "Dezembro de 2023",
        },
        {
            "facto": "Publicacao do destaque do INE do Dia Mundial da Saude",
            "valor": "4 de abril de 2025",
            "fonte": ine_pdf_path.name,
            "data_publicacao": "4 de abril de 2025",
        },
        {
            "facto": "Sintomas de ansiedade generalizada na populacao com 16 ou mais anos",
            "valor": "Em 2024, 32,0% tinham sintomas de ansiedade generalizada e 10,4% tinham niveis mais graves",
            "fonte": ine_pdf_path.name,
            "data_publicacao": "4 de abril de 2025",
        },
        {
            "facto": "Limitacoes na realizacao de atividades habituais devido a problemas de saude",
            "valor": "Atingiram 28,7% da populacao com 16 ou mais anos em 2024",
            "fonte": ine_pdf_path.name,
            "data_publicacao": "4 de abril de 2025",
        },
        {
            "facto": "Anos de vida saudavel aos 65 anos",
            "valor": "Em 2022, 8,6 anos para homens e 7,3 anos para mulheres; abaixo das medias UE-27 de 8,9 e 9,2",
            "fonte": ine_pdf_path.name,
            "data_publicacao": "4 de abril de 2025",
        },
    ]


def transform_sns_consultas() -> pd.DataFrame:
    """Aggregate SNS psychology consultations by year and region."""
    frame = _load_json_records(SNS_CONSULTAS_PATH)
    frame["ano"] = frame["tempo"].map(_extract_year)
    frame["regiao"] = frame["regiao"].map(_canonicalize_region)
    frame["consultas_sns"] = pd.to_numeric(
        frame["psicologia_total_de_consultas"],
        errors="coerce",
    )
    frame = frame.dropna(subset=["ano", "regiao"])
    frame["ano"] = frame["ano"].astype("int64")

    aggregated = (
        frame.groupby(["ano", "regiao"], as_index=False)
        .agg(consultas_sns=("consultas_sns", "sum"))
        .sort_values(["ano", "regiao"])
        .reset_index(drop=True)
    )
    logger.info("Processed consultas_sns with shape {}.", aggregated.shape)
    return aggregated


def transform_sns_capic() -> pd.DataFrame:
    """Aggregate CAPIC calls by year."""
    frame = _load_json_records(SNS_CAPIC_PATH)
    frame["ano"] = frame["data"].map(_extract_year)
    frame["capic_sns"] = pd.to_numeric(
        frame["n_o_de_chamadas_atendidas_no_capic"],
        errors="coerce",
    )
    frame = frame.dropna(subset=["ano"])
    frame["ano"] = frame["ano"].astype("int64")

    aggregated = (
        frame.groupby("ano", as_index=False)
        .agg(capic_sns=("capic_sns", "sum"))
        .sort_values("ano")
        .reset_index(drop=True)
    )
    logger.info("Processed capic_sns with shape {}.", aggregated.shape)
    return aggregated


def transform_ine_prevalencia() -> pd.DataFrame:
    """Extract the national prevalence figure from the INE workbook-like export."""
    if not INE_ICOR_PATH.exists():
        raise FileNotFoundError(f"Missing INE raw file: {INE_ICOR_PATH}")

    quadro_df = pd.read_excel(
        INE_ICOR_PATH,
        sheet_name="Quadro",
        header=None,
        engine="xlrd",
    )

    record: dict[str, Any] | None = None
    for row in quadro_df.itertuples(index=False):
        if _extract_year(row[0]) != 2019:
            continue
        if _normalize_text(row[1]) != "PT: Portugal":
            continue
        prevalence = _coerce_number(row[2])
        if prevalence is None:
            raise ValueError("Could not parse prevalence_ine from the INE row 2019/PT: Portugal.")
        record = {"ano": 2019, "prevalencia_ine": float(prevalence)}
        break

    if record is None:
        raise ValueError("Could not locate the 2019/PT: Portugal row in ine_icor_2023.csv.")

    frame = pd.DataFrame([record])
    logger.info("Processed prevalencia_ine with shape {}.", frame.shape)
    return frame


def transform_ine_ansiedade_2024() -> pd.DataFrame:
    """Extract the 2024 national anxiety metric from the INE health highlight PDF."""
    ine_pdf_path = _resolve_single_raw_file("04DiaMS*.pdf")
    text = _read_pdf_text(ine_pdf_path)
    normalized = _normalize_free_text(text)
    _ensure_contains(
        normalized,
        "32,0% da populacao com sintomas de ansiedade generalizada em 2024",
        ine_pdf_path.name,
    )

    match = re.search(
        r"em 2024.*?32,0% da populacao.*?10,4%",
        normalized,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if match is None:
        raise ValueError(f"Could not parse ansiedade_2024_ine from {ine_pdf_path.name}.")

    frame = pd.DataFrame([{"ano": 2024, "ansiedade_2024_ine": 32.0}])
    logger.info("Processed ansiedade_2024_ine with shape {}.", frame.shape)
    return frame


def transform_min_educ_ase() -> pd.DataFrame:
    """Extract annual ASE completion percentages from InfoEscolas."""
    cte_df = _read_infoescolas_sheet("CTEcomASEeEquidade")
    rows: list[dict[str, Any]] = []
    year_map = {
        2021: (3, 4),
        2022: (7, 8),
        2023: (11, 12),
    }

    for _, row in cte_df.iterrows():
        regiao = _canonicalize_region(row[1])
        if regiao is None:
            continue
        for ano, (weight_col, value_col) in year_map.items():
            weight = _coerce_number(row[weight_col])
            value = _coerce_number(row[value_col])
            if value is None or weight is None or weight <= 0:
                continue
            rows.append(
                {
                    "ano": ano,
                    "regiao": regiao,
                    "ase_percent_min_educ": value,
                    "weight": weight,
                }
            )

    frame = _weighted_group_average(
        pd.DataFrame(rows),
        group_columns=["ano", "regiao"],
        value_column="ase_percent_min_educ",
        weight_column="weight",
    )
    logger.info("Processed ase_percent_min_educ with shape {}.", frame.shape)
    return frame


def transform_min_educ_retencao() -> pd.DataFrame:
    """Extract annual retention rates from InfoEscolas using student-weighted averages."""
    retencao_df = _read_infoescolas_sheet("Retencao")
    populacao_df = _read_infoescolas_sheet("Populacao")
    population_lookup = {
        _normalize_text(row[0]): row for _, row in populacao_df.iterrows()
    }

    rows: list[dict[str, Any]] = []
    year_map = {
        2020: (3, 4, 5),
        2021: (6, 7, 8),
        2022: (9, 10, 11),
        2023: (12, 13, 14),
    }

    for _, row in retencao_df.iterrows():
        source_code = _normalize_text(row[0])
        regiao = _canonicalize_region(row[1])
        population_row = population_lookup.get(source_code)
        if regiao is None or population_row is None:
            continue

        for ano, retention_cols in year_map.items():
            weighted_sum = 0.0
            total_students = 0.0
            for column_index in retention_cols:
                retention = _coerce_number(row[column_index])
                students = _coerce_number(population_row[column_index])
                if retention is None or students is None or students <= 0:
                    continue
                weighted_sum += retention * students
                total_students += students

            if total_students <= 0:
                continue

            rows.append(
                {
                    "ano": ano,
                    "regiao": regiao,
                    "retencao_min_educ": weighted_sum / total_students,
                    "weight": total_students,
                }
            )

    frame = _weighted_group_average(
        pd.DataFrame(rows),
        group_columns=["ano", "regiao"],
        value_column="retencao_min_educ",
        weight_column="weight",
    )
    logger.info("Processed retencao_min_educ with shape {}.", frame.shape)
    return frame


def transform_google_interest_score(df_consultas: pd.DataFrame) -> pd.DataFrame:
    """Aggregate and rescale Google Trends to consultation-comparable magnitude."""
    frame = pd.read_csv(GOOGLE_TRENDS_PATH)
    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    frame = frame.dropna(subset=["date"])
    frame["ano"] = frame["date"].dt.year.astype("int64")
    frame["depressao"] = pd.to_numeric(frame["depressao"], errors="coerce")
    frame["ansiedade"] = pd.to_numeric(frame["ansiedade"], errors="coerce")
    frame["saude mental"] = pd.to_numeric(frame["saude mental"], errors="coerce")
    frame["interest_raw"] = frame[["depressao", "ansiedade", "saude mental"]].mean(axis=1)

    annual = (
        frame.groupby("ano", as_index=False)
        .agg(interest_raw=("interest_raw", "mean"))
        .sort_values("ano")
        .reset_index(drop=True)
    )
    annual = annual.loc[annual["ano"] < 2026].copy()

    national_consults = (
        df_consultas.groupby("ano", as_index=False)
        .agg(consultas_nacionais=("consultas_sns", "sum"))
        .sort_values("ano")
    )
    overlap = annual.merge(national_consults, on="ano", how="inner")
    if overlap.empty:
        raise ValueError("Google Trends and SNS consultations have no overlapping years.")

    raw_min = float(overlap["interest_raw"].min())
    raw_max = float(overlap["interest_raw"].max())
    consult_min = float(overlap["consultas_nacionais"].min())
    consult_max = float(overlap["consultas_nacionais"].max())

    if raw_max == raw_min:
        annual["google_interest_score"] = consult_max
    else:
        annual["google_interest_score"] = (
            (annual["interest_raw"] - raw_min) / (raw_max - raw_min)
        ) * (consult_max - consult_min) + consult_min

    result = annual[["ano", "google_interest_score"]].copy()
    logger.info("Processed google_interest_score with shape {}.", result.shape)
    return result


def transform_spending_eurostat() -> pd.DataFrame:
    """Extract annual Euro per inhabitant spending from Eurostat."""
    payload = json.loads(EUROSTAT_PATH.read_text(encoding="utf-8"))
    dimension = payload["dimension"]
    unit_index = dimension["unit"]["category"]["index"]
    financing_index = dimension["icha11_hf"]["category"]["index"]
    geo_index = dimension["geo"]["category"]["index"]
    time_index = dimension["time"]["category"]["index"]
    size_unit = payload["size"][1]
    size_financing = payload["size"][2]
    size_geo = payload["size"][3]
    size_time = payload["size"][4]

    rows: list[dict[str, Any]] = []
    for year_text, time_position in time_index.items():
        linear_position = (
            (((0 * size_unit + unit_index["EUR_HAB"]) * size_financing + financing_index["TOT_HF"]) * size_geo)
            + geo_index["PT"]
        ) * size_time + time_position
        value = payload.get("value", {}).get(str(linear_position))
        if value is None:
            continue
        rows.append({"ano": int(year_text), "spending_eurostat": float(value)})

    frame = pd.DataFrame(rows).sort_values("ano").reset_index(drop=True)
    logger.info("Processed spending_eurostat with shape {}.", frame.shape)
    return frame


def build_dashboard_main(
    df_consultas: pd.DataFrame,
    df_capic: pd.DataFrame,
    df_prevalencia: pd.DataFrame,
    df_ansiedade: pd.DataFrame,
    df_ase: pd.DataFrame,
    df_retencao: pd.DataFrame,
    df_trends: pd.DataFrame,
    df_spending: pd.DataFrame,
) -> pd.DataFrame:
    """Build the final source-tagged dashboard."""
    dashboard = (
        df_consultas.merge(df_capic, on="ano", how="left", validate="m:1")
        .merge(df_prevalencia, on="ano", how="left", validate="m:1")
        .merge(df_ansiedade, on="ano", how="left", validate="m:1")
        .merge(df_ase, on=["ano", "regiao"], how="left", validate="m:1")
        .merge(df_retencao, on=["ano", "regiao"], how="left", validate="m:1")
        .merge(df_trends, on="ano", how="left", validate="m:1")
        .merge(df_spending, on="ano", how="left", validate="m:1")
        .sort_values(["ano", "regiao"])
        .reset_index(drop=True)
    )

    dashboard = dashboard[FINAL_COLUMNS].copy()
    logger.info("Built dashboard_main with shape {}.", dashboard.shape)
    return dashboard


def build_data_lineage() -> dict[str, dict[str, str]]:
    """Build lineage metadata for every dashboard column."""
    ers_path = _resolve_single_raw_file("estudo_saude_mental_*.pdf")
    ine_pdf_path = _resolve_single_raw_file("04DiaMS*.pdf")

    return {
        "ano": {
            "source": "Derived Join Key",
            "file_origin": (
                "data/raw/sns_consultas.json | data/raw/sns_capic.json | "
                "data/raw/eurostat_hlth_sha11_hf_pt.json | data/raw/google_trends_saude_mental_pt.csv | "
                "data/raw/ine_icor_2023.csv | data/raw/InfoEscolas2024_Secundario_CH_DadosPorRegiao.xlsx"
            ),
            "reliability_score": "Medium (Derived from official period fields)",
            "last_updated": "2026-03-20",
        },
        "regiao": {
            "source": "Derived Join Key",
            "file_origin": "data/raw/sns_consultas.json | data/raw/InfoEscolas2024_Secundario_CH_DadosPorRegiao.xlsx",
            "reliability_score": "Medium (Canonicalized from source-specific region labels)",
            "last_updated": "2026-03-20",
        },
        "consultas_sns": {
            "source": "Portal Transparencia SNS",
            "file_origin": "data/raw/sns_consultas.json",
            "reliability_score": "High (Official API/Report)",
            "last_updated": "2026-03-20",
        },
        "capic_sns": {
            "source": "Portal Transparencia SNS",
            "file_origin": "data/raw/sns_capic.json",
            "reliability_score": "High (Official API/Report)",
            "last_updated": "2026-03-20",
        },
        "prevalencia_ine": {
            "source": "INE",
            "file_origin": "data/raw/ine_icor_2023.csv",
            "reliability_score": "High (Official report export, stored locally as XLS-format file with .csv extension)",
            "last_updated": "2026-03-20",
        },
        "ansiedade_2024_ine": {
            "source": "INE/Destaque 2025",
            "file_origin": _relative_raw_path(ine_pdf_path),
            "reliability_score": "High (Official INE PDF highlight)",
            "last_updated": "2026-03-20",
        },
        "ase_percent_min_educ": {
            "source": "Ministerio da Educacao / InfoEscolas 2024",
            "file_origin": "data/raw/InfoEscolas2024_Secundario_CH_DadosPorRegiao.xlsx",
            "reliability_score": "High (Official workbook)",
            "last_updated": "2026-03-20",
        },
        "retencao_min_educ": {
            "source": "Ministerio da Educacao / InfoEscolas 2024",
            "file_origin": "data/raw/InfoEscolas2024_Secundario_CH_DadosPorRegiao.xlsx",
            "reliability_score": "High (Official workbook)",
            "last_updated": "2026-03-20",
        },
        "google_interest_score": {
            "source": "Google Trends",
            "file_origin": "data/raw/google_trends_saude_mental_pt.csv",
            "reliability_score": "Medium (Official platform export, then yearly aggregated and rescaled)",
            "last_updated": "2026-03-20",
        },
        "spending_eurostat": {
            "source": "Eurostat",
            "file_origin": "data/raw/eurostat_hlth_sha11_hf_pt.json",
            "reliability_score": "High (Official API/Report)",
            "last_updated": "2026-03-20",
        },
    }


def assert_source_contract(
    dashboard_df: pd.DataFrame,
    data_lineage: dict[str, dict[str, str]],
) -> None:
    """Fail if the final dashboard is not fully covered by lineage metadata."""
    dashboard_columns = set(dashboard_df.columns)
    lineage_columns = set(data_lineage.keys())
    if dashboard_columns != lineage_columns:
        missing_in_lineage = sorted(dashboard_columns - lineage_columns)
        extra_in_lineage = sorted(lineage_columns - dashboard_columns)
        raise ValueError(
            "Lineage coverage mismatch. "
            f"Missing in lineage: {missing_in_lineage}. Extra in lineage: {extra_in_lineage}."
        )

    for column_name, lineage in data_lineage.items():
        file_origin = lineage["file_origin"]
        for path_text in file_origin.split(" | "):
            candidate = Path(path_text)
            if not candidate.exists():
                raise FileNotFoundError(
                    f"Lineage for column '{column_name}' references missing path: {path_text}"
                )

    logger.info("Source contract validated for {} dashboard columns.", len(dashboard_df.columns))


def _resolve_single_raw_file(glob_pattern: str) -> Path:
    """Resolve a single raw file by glob pattern."""
    matches = sorted(RAW_DATA_DIR.glob(glob_pattern))
    if len(matches) != 1:
        raise FileNotFoundError(
            f"Expected exactly one match for pattern '{glob_pattern}' in {RAW_DATA_DIR}, got {len(matches)}."
        )
    return matches[0]


def _read_pdf_text(pdf_path: Path) -> str:
    """Read all extractable text from a PDF."""
    text_chunks: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            if page_text:
                text_chunks.append(page_text)
    return "\n".join(text_chunks)


def _read_infoescolas_sheet(sheet_name: str) -> pd.DataFrame:
    """Read one InfoEscolas sheet and keep only NUTS II rows."""
    frame = pd.read_excel(INFOESCOLAS_PATH, sheet_name=sheet_name, header=None)
    frame = frame.iloc[7:].copy().reset_index(drop=True)
    frame = frame.dropna(how="all")
    frame = frame.loc[frame[2].astype(str).str.strip().eq("NUTS II")].copy()
    return frame.reset_index(drop=True)


def _weighted_group_average(
    frame: pd.DataFrame,
    group_columns: list[str],
    value_column: str,
    weight_column: str,
) -> pd.DataFrame:
    """Compute a weighted mean for grouped data."""
    if frame.empty:
        return pd.DataFrame(columns=[*group_columns, value_column])

    working = frame.copy()
    working["weighted_component"] = working[value_column] * working[weight_column]
    aggregated = (
        working.groupby(group_columns, as_index=False)
        .agg(
            weighted_component=("weighted_component", "sum"),
            total_weight=(weight_column, "sum"),
        )
        .reset_index(drop=True)
    )
    aggregated[value_column] = aggregated["weighted_component"] / aggregated["total_weight"]
    aggregated = aggregated.drop(columns=["weighted_component", "total_weight"])
    return aggregated.sort_values(group_columns).reset_index(drop=True)


def _load_json_records(file_path: Path) -> pd.DataFrame:
    """Load a JSON array file into a DataFrame."""
    with file_path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, list):
        raise ValueError(f"Expected a JSON array in {file_path}, got {type(payload).__name__}.")
    return pd.DataFrame(payload)


def _save_json(destination: Path, payload: Any) -> None:
    """Save JSON using UTF-8 with stable indentation."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def _relative_raw_path(path: Path) -> str:
    """Return a project-relative path string."""
    return path.as_posix()


def _normalize_free_text(text: str) -> str:
    """Normalize free text for robust substring matching."""
    normalized = text.lower()
    translation = str.maketrans(
        {
            "á": "a",
            "à": "a",
            "â": "a",
            "ã": "a",
            "é": "e",
            "ê": "e",
            "í": "i",
            "ó": "o",
            "ô": "o",
            "õ": "o",
            "ú": "u",
            "ç": "c",
            "\n": " ",
        }
    )
    normalized = normalized.translate(translation)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def _ensure_contains(text: str, needle: str, source_name: str) -> None:
    """Raise a detailed error when expected evidence is missing."""
    if needle not in text:
        raise ValueError(f"Expected evidence '{needle}' was not found in {source_name}.")


def _extract_year(value: Any) -> int | None:
    """Extract the first four-digit year from a value."""
    match = re.search(r"((?:19|20)\d{2})", "" if value is None else str(value))
    if match is None:
        return None
    return int(match.group(1))


def _normalize_text(value: Any) -> str:
    """Normalize a text-like value into a stripped string."""
    return "" if value is None else str(value).strip()


def _coerce_number(value: Any) -> float | None:
    """Convert localized numeric text into a parseable float."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    if not text:
        return None
    text = text.replace("\u00a0", "").replace(" ", "").replace("%", "")
    text = text.replace(".", "").replace(",", ".")
    text = re.sub(r"[^0-9.\-]", "", text)
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _canonicalize_region(value: Any) -> str | None:
    """Map source-specific region labels to the dashboard region key."""
    normalized = _normalize_free_text(_normalize_text(value))
    return REGION_CANONICAL_MAP.get(normalized)


__all__ = [
    "DATA_LINEAGE_PATH",
    "DASHBOARD_MAIN_PATH",
    "FINAL_COLUMNS",
    "STUDY_INSIGHTS_PATH",
    "assert_source_contract",
    "build_dashboard_main",
    "build_data_lineage",
    "clean_processed_directory",
    "extract_study_insights",
    "run_transform_pipeline",
    "transform_google_interest_score",
    "transform_ine_ansiedade_2024",
    "transform_ine_prevalencia",
    "transform_min_educ_ase",
    "transform_min_educ_retencao",
    "transform_sns_capic",
    "transform_sns_consultas",
    "transform_spending_eurostat",
]


if __name__ == "__main__":
    logger.info("A iniciar o pipeline de transformacao...")
    try:
        run_transform_pipeline()
    except Exception:
        logger.exception("Falha fatal no pipeline de transformacao:")
        raise
