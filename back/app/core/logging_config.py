"""Configuration du logging (JSON en production, lisible en développement)."""
from __future__ import annotations

import logging
import sys

from pythonjsonlogger import json as jsonlogger

from app.core.config import settings


def setup_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    if settings.is_production:
        handler.setFormatter(
            jsonlogger.JsonFormatter(
                "%(asctime)s %(levelname)s %(name)s %(message)s",
                rename_fields={"asctime": "timestamp", "levelname": "level"},
            )
        )
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s | %(levelname)-8s | %(name)s | %(message)s")
        )

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)

    for noisy in ("sqlalchemy.engine", "asyncio", "aiosqlite"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
