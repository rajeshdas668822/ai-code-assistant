from pydantic import BaseModel
from typing import Optional

class CompletionRequest(BaseModel):
    prompt: str
    model: str = "qwen2.5-coder:14b"
    system: Optional[str] = None
    temperature: float = 0.2      # low = deterministic, good for code
    max_tokens: int = 2048

class CompletionResponse(BaseModel):
    text: str
    model: str
    tokens_used: int