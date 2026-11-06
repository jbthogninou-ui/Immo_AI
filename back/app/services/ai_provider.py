"""Abstraction des fournisseurs LLM (OpenAI / Groq / Anthropic / repli local)."""
from __future__ import annotations

import json
import logging
from typing import Any, Protocol

import httpx

from app.core.config import settings
from app.core.exceptions import ExternalServiceError

logger = logging.getLogger(__name__)


class LLMProvider(Protocol):
    name: str

    async def complete(self, *, system: str, prompt: str, max_tokens: int = 800) -> str: ...


class NullProvider:
    """Repli déterministe : l'API reste 100 % fonctionnelle sans clé LLM."""

    name = "local"

    async def complete(self, *, system: str, prompt: str, max_tokens: int = 800) -> str:
        raise ExternalServiceError(
            "Aucun fournisseur IA configuré (AI_PROVIDER=none).",
            error_code="ai_provider_disabled",
        )


class OpenAICompatibleProvider:
    """Compatible OpenAI et Groq (même schéma /chat/completions)."""

    def __init__(self, name: str, base_url: str) -> None:
        self.name = name
        self.base_url = base_url

    async def complete(self, *, system: str, prompt: str, max_tokens: int = 800) -> str:
        payload = {
            "model": settings.AI_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": max_tokens,
            "temperature": 0.6,
        }
        headers = {"Authorization": f"Bearer {settings.AI_API_KEY}"}
        try:
            async with httpx.AsyncClient(timeout=settings.AI_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions", json=payload, headers=headers
                )
                response.raise_for_status()
                body = response.json()
            return body["choices"][0]["message"]["content"].strip()
        except httpx.HTTPError as exc:
            logger.warning("Appel LLM %s en échec: %s", self.name, exc)
            raise ExternalServiceError("Le service IA est temporairement indisponible.") from exc


class AnthropicProvider:
    name = "anthropic"

    async def complete(self, *, system: str, prompt: str, max_tokens: int = 800) -> str:
        payload: dict[str, Any] = {
            "model": settings.AI_MODEL,
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": prompt}],
        }
        headers = {
            "x-api-key": settings.AI_API_KEY or "",
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=settings.AI_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages", json=payload, headers=headers
                )
                response.raise_for_status()
                body = response.json()
            return "".join(
                block.get("text", "") for block in body.get("content", [])
            ).strip()
        except httpx.HTTPError as exc:
            logger.warning("Appel Anthropic en échec: %s", exc)
            raise ExternalServiceError("Le service IA est temporairement indisponible.") from exc


def get_provider() -> LLMProvider:
    if not settings.AI_API_KEY or settings.AI_PROVIDER == "none":
        return NullProvider()
    if settings.AI_PROVIDER == "openai":
        return OpenAICompatibleProvider("openai", "https://api.openai.com/v1")
    if settings.AI_PROVIDER == "groq":
        return OpenAICompatibleProvider("groq", "https://api.groq.com/openai/v1")
    if settings.AI_PROVIDER == "anthropic":
        return AnthropicProvider()
    return NullProvider()


def parse_json_response(raw: str) -> dict:
    """Extrait un objet JSON d'une réponse LLM (tolère les blocs Markdown)."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        text = text[4:] if text.lower().startswith("json") else text
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Réponse LLM sans JSON exploitable.")
    return json.loads(text[start : end + 1])
