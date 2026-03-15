"""
Market Panic — Gemini Client

Shared Gemini client using the new google.genai SDK.
Uses gemini-2.5-flash for agent brains and gemini-embedding-001 for embeddings.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

# Model constants
LLM_MODEL = "gemini-2.5-flash"
FLASH_MODEL = "gemini-2.5-flash"
EMBEDDING_MODEL = "gemini-embedding-001"

# Shared client instance
_client: genai.Client | None = None


def get_client() -> genai.Client:
    """Get or create the shared Gemini client."""
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY not set")
        _client = genai.Client(api_key=api_key)
    return _client


async def generate(prompt: str, system: str | None = None, model: str | None = None) -> str:
    """Generate text using Gemini. Returns the response text (never None)."""
    client = get_client()
    model = model or LLM_MODEL

    config = None
    if system:
        config = types.GenerateContentConfig(system_instruction=system)

    response = await client.aio.models.generate_content(
        model=model,
        contents=prompt,
        config=config,
    )
    # Guard against None response
    return response.text or ""


def embed(texts: list[str], model: str = EMBEDDING_MODEL) -> list[list[float]]:
    """Embed texts using Gemini embedding model. Returns list of vectors."""
    client = get_client()
    result = client.models.embed_content(
        model=model,
        contents=texts,
    )
    return [e.values for e in result.embeddings]
