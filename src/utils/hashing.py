from __future__ import annotations

import hashlib
from pathlib import Path

DEFAULT_CHUNK_SIZE = 1024 * 1024


def compute_md5(file_path: Path, chunk_size: int = DEFAULT_CHUNK_SIZE) -> str:
    """Return the MD5 digest for a file using chunked reads."""
    digest = hashlib.md5()

    with file_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(chunk_size), b""):
            digest.update(chunk)

    return digest.hexdigest()
