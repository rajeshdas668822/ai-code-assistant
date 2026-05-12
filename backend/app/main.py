from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import json

from .llm.models import CompletionRequest, CompletionResponse
from .llm.client import stream_completion, get_completion

app = FastAPI(
    title="Code Assist Backend",
    description="Multi-agent code assistant - Week 1 baseline",
    version="0.1.0"
)

# Allow VSCode extension (running locally) to call this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten this later
    allow_methods=["*"],
    allow_headers=["*"],
)

CODE_SYSTEM_PROMPT = """You are an expert software engineer and code assistant.
When asked to write code:
- Write clean, production-quality code
- Add brief inline comments for non-obvious logic
- Prefer explicit over implicit
- Return only the code unless explanation is specifically requested"""


@app.get("/health")
async def health():
    return {"status": "ok", "model": "qwen2.5-coder:7b"}


@app.post("/complete")
async def complete(request: CompletionRequest):
    """
    Non-streaming endpoint. Returns full response as JSON.
    Good for testing with curl.
    """
    try:
        result = await get_completion(
            prompt=request.prompt,
            model=request.model,
            system=request.system or CODE_SYSTEM_PROMPT,
            temperature=request.temperature,
        )
        return CompletionResponse(
            text=result["response"],
            model=result["model"],
            tokens_used=result.get("eval_count", 0),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/stream")
async def stream(request: CompletionRequest):
    """
    Streaming endpoint. Returns Server-Sent Events (SSE).
    The VSCode extension will consume this for real-time display.
    """
    async def token_generator():
        try:
            async for token in stream_completion(
                prompt=request.prompt,
                model=request.model,
                system=request.system or CODE_SYSTEM_PROMPT,
                temperature=request.temperature,
            ):
                # SSE format: each chunk is "data: <json>\n\n"
                payload = json.dumps({"token": token})
                yield f"data: {payload}\n\n"
            # Signal end of stream
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        token_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # important for nginx proxies
        }
    )


@app.post("/explain")
async def explain_code(request: CompletionRequest):
    """
    Dedicated endpoint for code explanation.
    Wraps the prompt with explanation-specific instructions.
    """
    explain_prompt = f"""Explain the following code clearly and concisely.
Cover: what it does, how it works, any notable patterns or gotchas.

{request.prompt}"""

    async def explain_generator():
        async for token in stream_completion(
            prompt=explain_prompt,
            system="You are a senior engineer explaining code to a smart colleague. Be precise, not verbose.",
            temperature=0.3,
        ):
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(explain_generator(), media_type="text/event-stream")
