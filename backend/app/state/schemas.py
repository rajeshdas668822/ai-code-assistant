"""Pydantic models for agent state and API schemas."""

from __future__ import annotations

from typing import TypedDict

from pydantic import BaseModel


# --- Agent State (used by LangGraph) ---

class FileContext(BaseModel):
    file_path: str
    file_content: str = ""
    selection: dict | None = None  # {"start": int, "end": int}
    language: str = ""


class ReviewResult(BaseModel):
    passed: bool
    feedback: str = ""


class AgentState(TypedDict, total=False):
    messages: list
    plan: str | None
    code: str | None
    review: ReviewResult | None
    context_snippets: list[str]
    current_agent: str
    iteration: int
    user_request: str
    file_context: FileContext


# --- API Request / Response Models ---

class ChatRequest(BaseModel):
    message: str
    context: FileContext | None = None
    workspace_path: str = ""
    conversation_id: str = ""


class ChatResponse(BaseModel):
    conversation_id: str
    content: str
    agent: str = ""


class CompleteRequest(BaseModel):
    file_path: str
    content_before_cursor: str
    content_after_cursor: str = ""
    language: str = ""
    max_tokens: int = 128


class CompleteResponse(BaseModel):
    completion: str


class IndexRequest(BaseModel):
    workspace_path: str
    incremental: bool = False
    changed_files: list[str] = []
