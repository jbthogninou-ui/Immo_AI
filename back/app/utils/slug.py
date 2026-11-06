"""Génération de slugs et de références lisibles."""
from __future__ import annotations

import re
import secrets
import unicodedata


def slugify(value: str, *, max_length: int = 120) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^\w\s-]", "", value).strip().lower()
    value = re.sub(r"[-\s]+", "-", value)
    return value[:max_length].strip("-") or "item"


def unique_slug(value: str, *, suffix_length: int = 4) -> str:
    return f"{slugify(value)}-{secrets.token_hex(suffix_length // 2)}"
