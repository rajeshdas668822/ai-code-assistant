import os
import httpx
import json
from typing import AsyncGenerator

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")


async def stream_completion(
    prompt: str,
    model: str = "qwen2.5-coder:7b",
    system: str | None = None,
    temperature: float = 0.2,
) -> AsyncGenerator[str, None]:
    """
    Streams tokens from Ollama one by one.
    Tries /api/generate first, falls back to /api/chat if 404.
    """
    # Build messages for /api/chat format
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    # Try /api/chat (newer Ollama versions)
    chat_payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "options": {
            "temperature": temperature,
            "num_predict": 2048,
        },
    }

    # Try /api/generate (older Ollama versions) as fallback
    generate_payload = {
        "model": model,
        "prompt": prompt,
        "stream": True,
        "options": {
            "temperature": temperature,
            "num_predict": 2048,
        },
    }
    if system:
        generate_payload["system"] = system

    async with httpx.AsyncClient(timeout=120.0) as client:
        # Try /api/chat first
        try:
            async with client.stream(
                "POST",
                f"{OLLAMA_BASE_URL}/api/chat",
                json=chat_payload,
            ) as response:
                if response.status_code == 404:
                    pass  # Fall through to /api/generate
                else:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if line.strip():
                            data = json.loads(line)
                            # /api/chat returns content in message.content
                            token = data.get("message", {}).get("content", "")
                            if token:
                                yield token
                            if data.get("done", False):
                                break
                    return
        except httpx.HTTPStatusError as e:
            if e.response.status_code != 404:
                raise

        # Fallback to /api/generate
        async with client.stream(
            "POST",
            f"{OLLAMA_BASE_URL}/api/generate",
            json=generate_payload,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.strip():
                    data = json.loads(line)
                    token = data.get("response", "")
                    if token:
                        yield token
                    if data.get("done", False):
                        break


async def get_completion(
    prompt: str,
    model: str = "qwen2.5-coder:7b",
    system: str | None = None,
    temperature: float = 0.2,
) -> dict:
    """
    Non-streaming version — returns the full response at once.
    Tries /api/chat first, falls back to /api/generate.
    """
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    chat_payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": 2048,
        },
    }

    generate_payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": 2048,
        },
    }
    if system:
        generate_payload["system"] = system

    async with httpx.AsyncClient(timeout=120.0) as client:
        # Try /api/chat first
        response = await client.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json=chat_payload,
        )

        if response.status_code == 404:
            # Fallback to /api/generate
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json=generate_payload,
            )
            response.raise_for_status()
            return response.json()

        response.raise_for_status()
        result = response.json()

        # Normalize response format to match what main.py expects
        return {
            "response": result.get("message", {}).get("content", ""),
            "model": result.get("model", model),
            "eval_count": result.get("eval_count", 0),
        }
