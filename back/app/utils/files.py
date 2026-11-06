"""Validation et normalisation des fichiers uploadés."""
from __future__ import annotations

import hashlib
import os
import re
import uuid

from app.core.exceptions import ValidationError

IMAGE_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"}
DOCUMENT_MIME = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
}
VIDEO_MIME = {"video/mp4", "video/quicktime", "video/webm"}
ALLOWED_MIME = IMAGE_MIME | DOCUMENT_MIME | VIDEO_MIME

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]")


def sanitize_filename(filename: str, *, max_length: int = 120) -> str:
    base = os.path.basename(filename or "fichier")
    base = _SAFE_NAME.sub("_", base)
    return base[:max_length] or "fichier"


def validate_upload(filename: str, mime_type: str | None, size: int, max_bytes: int) -> str:
    mime = (mime_type or "application/octet-stream").lower().split(";")[0]
    if mime not in ALLOWED_MIME:
        raise ValidationError(
            f"Type de fichier non autorisé : {mime}",
            details={"allowed": sorted(ALLOWED_MIME)},
        )
    if size > max_bytes:
        raise ValidationError(
            f"Fichier trop volumineux ({size} octets, maximum {max_bytes})."
        )
    if size <= 0:
        raise ValidationError("Fichier vide.")
    return mime


def build_storage_key(prefix: str, filename: str) -> str:
    safe = sanitize_filename(filename)
    return f"{prefix.strip('/')}/{uuid.uuid4().hex}_{safe}"


def checksum(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def media_type_from_mime(mime: str) -> str:
    if mime in IMAGE_MIME:
        return "IMAGE"
    if mime in VIDEO_MIME:
        return "VIDEO"
    return "DOCUMENT"
