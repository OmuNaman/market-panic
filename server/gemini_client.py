"""
Market Panic — Gemini Client

Shared Gemini client using the new google.genai SDK.
Uses gemini-2.5-pro for agent brains and gemini-embedding-001 for embeddings.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from google import genai

load_dotenv()

# Model constants
LLM_MODEL = "gemini-2.5-pro"
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


async def generate(prompt: str, system: str | None = None, model: str = LLM_MODEL) -> str:
    """Generate text using Gemini. Returns the response text."""
    client = get_client()

    config = {}
    if system:
        config["system_instruction"] = system

    response = await client.aio.models.generate_content(
        model=model,
        contents=prompt,
        config=config if config else None,
    )
    return response.text


def embed(texts: list[str], model: str = EMBEDDING_MODEL) -> list[list[float]]:
    """Embed texts using Gemini embedding model. Returns list of vectors."""
    client = get_client()
    result = client.models.embed_content(
        model=model,
        contents=texts,
    )
    return [e.values for e in result.embeddings]
