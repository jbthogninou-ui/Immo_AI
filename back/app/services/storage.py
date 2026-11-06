"""Service de stockage de fichiers (backend local, extensible S3)."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Protocol

import aiofiles

from app.core.config import settings
from app.core.exceptions import NotFoundError

logger = logging.getLogger(__name__)


class StorageBackend(Protocol):
    async def save(self, key: str, content: bytes) -> str: ...
    async def read(self, key: str) -> bytes: ...
    async def delete(self, key: str) -> None: ...
    def public_url(self, key: str) -> str: ...


class LocalStorage:
    """Stockage disque. Les fichiers ne sont jamais servis directement :
    ils transitent par l'API pour appliquer le contrôle d'accès."""

    def __init__(self, root: str | None = None) -> None:
        self.root = Path(root or settings.UPLOAD_DIR).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        target = (self.root / key.lstrip("/")).resolve()
        if not str(target).startswith(str(self.root)):
            raise ValueError("Chemin de stockage invalide (path traversal).")
        return target

    async def save(self, key: str, content: bytes) -> str:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(path, "wb") as handle:
            await handle.write(content)
        return key

    async def read(self, key: str) -> bytes:
        path = self._path(key)
        if not path.exists():
            raise NotFoundError("Fichier introuvable sur le stockage.")
        async with aiofiles.open(path, "rb") as handle:
            return await handle.read()

    async def delete(self, key: str) -> None:
        path = self._path(key)
        if path.exists():
            path.unlink()

    def public_url(self, key: str) -> str:
        return f"{settings.PUBLIC_BASE_URL}{settings.API_V1_PREFIX}/documents/files/{key}"


def get_storage() -> StorageBackend:
    if settings.STORAGE_BACKEND == "s3":  # pragma: no cover - hors périmètre V1
        logger.warning("Backend S3 non configuré : repli sur le stockage local.")
    return LocalStorage()


storage = get_storage()
