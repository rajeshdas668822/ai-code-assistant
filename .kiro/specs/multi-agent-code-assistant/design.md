# Multi-Agent Code Assistant — Design

## Architecture Overview

The system follows a three-tier architecture:

```
┌─────────────────────────────────────────┐
│  Tier 1: VS Code Extension (TypeScript) │
│  UI, editor integration, Tree-sitter    │
└──────────────────┬──────────────────────┘
                   │ HTTP / WebSocket
┌──────────────────▼──────────────────────┐
│  Tier 2: Agent Backend (Python)         │
│  LangGraph orchestration, RAG pipeline  │
└──────────────────┬──────────────────────┘
                   │ OpenAI-compatible API
┌──────────────────▼──────────────────────┐
│  Tier 3: Model Serving                  │
│  vLLM / Ollama                          │
└─────────────────────────────────────────┘
```

## Technology Choices

### LLM Models
- **Primary code model**: Qwen2.5-Coder-32B-Instruct — best open-source code model for its size, strong on HumanEval/MBPP benchmarks
- **Fast completion model**: Qwen2.5-Coder-7B-Instruct — smaller variant for low-latency inline completions
- **Embedding model**: nomic-embed-text v1.5 — open-source, runs locally, good code understanding
- **Fallback**: DeepSeek-Coder-V2-Lite-Instruct (16B) as an alternative primary model

### Model Serving
- **Ollama** — default for local development and single-user deployment. Zero-config, supports GGUF quantization, OpenAI-compatible API.
- **vLLM** — recommended for team/server deployment. PagedAttention, continuous batching, higher throughput under concurrent load.
- Both expose OpenAI-compatible `/v1/chat/completions` and `/v1/completions` endpoints, so the backend code is serving-layer agnostic.

### Multi-Agent Framework: LangGraph
**Why LangGraph over alternatives:**
- Graph-based orchestration allows explicit, deterministic agent workflows (not just "agents chatting")
- Built-in support for cycles (agent can loop back for refinement), conditional edges, and human-in-the-loop
- State management — each node in the graph can read/write shared state
- Streaming support out of the box
- Better debuggability than conversational approaches (AutoGen) — you can visualize and trace the graph

### RAG Pipeline
- **Vector Store**: ChromaDB — embedded mode (no separate server), persistent storage, good Python integration
- **Embedding**: nomic-embed-text via Ollama or sentence-transformers
- **Chunking**: Tree-sitter based — split code by functions/classes/methods rather than arbitrary token windows
- **Retrieval**: Hybrid search (vector similarity + BM25 keyword matching) for better recall

### VS Code Extension
- **Language**: TypeScript (required by VS Code Extension API)
- **Code Parsing**: Tree-sitter via web-tree-sitter (WASM bindings) for AST analysis in the extension
- **Communication**: WebSocket for streaming, HTTP for request/response
- **UI**: VS Code Webview API for the chat panel, native API for code actions/completions

## Component Design

### Component 1: VS Code Extension (`extension/`)

```
extension/
├── src/
│   ├── extension.ts              # Entry point, activation
│   ├── chat/
│   │   ├── ChatViewProvider.ts   # Webview panel for chat UI
│   │   └── chatWebview.html      # Chat UI (HTML/CSS/JS)
│   ├── completion/
│   │   └── CompletionProvider.ts # Inline completion provider
│   ├── actions/
│   │   ├── CodeActionProvider.ts # Context menu actions
│   │   └── CodeLensProvider.ts   # Inline code lens
│   ├── context/
│   │   ├── FileContext.ts        # Current file/selection context
│   │   └── TreeSitterParser.ts   # AST parsing for symbol extraction
│   ├── backend/
│   │   ├── BackendClient.ts      # HTTP/WS client to Python backend
│   │   └── StreamHandler.ts      # SSE/WebSocket stream processing
│   ├── config/
│   │   └── Settings.ts           # Extension settings management
│   └── status/
│       └── StatusBar.ts          # Status bar items (model status, toggle)
├── package.json                  # Extension manifest
└── tsconfig.json
```

**Key Design Decisions:**
- Chat UI uses a Webview with a lightweight frontend (no React — keep it simple and fast)
- CompletionProvider implements `vscode.InlineCompletionItemProvider` for ghost text
- BackendClient abstracts all communication — extension code never talks to the model directly
- Tree-sitter runs in the extension for fast, local AST parsing (symbol extraction, scope detection)

### Component 2: Agent Backend (`backend/`)

```
backend/
├── app/
│   ├── main.py                   # FastAPI app entry point
│   ├── api/
│   │   ├── chat.py               # POST /chat — main chat endpoint
│   │   ├── complete.py           # POST /complete — code completion
│   │   ├── index.py              # POST /index — trigger codebase indexing
│   │   └── health.py             # GET /health — health check
│   ├── agents/
│   │   ├── graph.py              # LangGraph workflow definition
│   │   ├── planner.py            # Planner agent node
│   │   ├── coder.py              # Coder agent node
│   │   ├── reviewer.py           # Reviewer agent node
│   │   ├── debugger.py           # Debugger agent node
│   │   └── router.py             # Intent classification & routing
│   ├── rag/
│   │   ├── indexer.py            # Codebase indexing pipeline
│   │   ├── chunker.py            # Tree-sitter based code chunking
│   │   ├── retriever.py          # Hybrid retrieval (vector + BM25)
│   │   └── embeddings.py         # Embedding model client
│   ├── llm/
│   │   ├── client.py             # OpenAI-compatible LLM client
│   │   └── models.py             # Model configuration & registry
│   ├── prompts/
│   │   ├── planner.md            # Planner system prompt
│   │   ├── coder.md              # Coder system prompt
│   │   ├── reviewer.md           # Reviewer system prompt
│   │   └── debugger.md           # Debugger system prompt
│   └── state/
│       └── schemas.py            # Pydantic models for agent state
├── requirements.txt
└── pyproject.toml
```

### Component 3: LangGraph Agent Workflow

```
                    ┌──────────┐
                    │  Router  │
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        ┌──────────┐ ┌────────┐ ┌──────────┐
        │ Planner  │ │ Direct │ │ Debugger │
        └────┬─────┘ │ Answer │ └────┬─────┘
             │       └────────┘      │
             ▼                       ▼
        ┌──────────┐          ┌──────────┐
        │  Coder   │          │  Coder   │
        └────┬─────┘          └────┬─────┘
             │                     │
             ▼                     ▼
        ┌──────────┐          ┌──────────┐
        │ Reviewer │          │ Reviewer │
        └────┬─────┘          └────┬─────┘
             │                     │
             ▼ (if issues found)   │
        ┌──────────┐               │
        │  Coder   │◄─────────────┘
        │ (retry)  │
        └──────────┘
```

**State Schema:**
```python
class AgentState(TypedDict):
    messages: list[BaseMessage]          # Conversation history
    plan: str | None                     # Planner output
    code: str | None                     # Generated code
    review: ReviewResult | None          # Reviewer feedback
    context_snippets: list[str]          # RAG retrieved context
    current_agent: str                   # Active agent name
    iteration: int                       # Retry counter (max 2)
    user_request: str                    # Original user request
    file_context: FileContext            # Current file, selection, language
```

**Routing Logic:**
- Simple questions (explain, what is) → Direct Answer
- Code generation/modification requests → Planner → Coder → Reviewer
- Error/bug fix requests → Debugger → Coder → Reviewer
- Reviewer can send back to Coder (max 2 iterations)

### Component 4: RAG Pipeline

**Indexing Flow:**
1. Walk workspace files (respecting .gitignore)
2. Parse each file with Tree-sitter → extract functions, classes, methods as chunks
3. Each chunk gets metadata: file path, symbol name, language, line range
4. Embed chunks using nomic-embed-text
5. Store in ChromaDB with metadata filtering support
6. Persist index to `{workspace}/.vscode/agent-index/`

**Retrieval Flow:**
1. User query + current file context → generate search query
2. Vector similarity search (top 10 candidates)
3. BM25 keyword search (top 10 candidates)
4. Reciprocal Rank Fusion to merge results
5. Re-rank by relevance to current file/language
6. Return top 5 chunks as context for agents

## API Design

### POST /chat (WebSocket upgrade for streaming)
```json
{
  "message": "Refactor this function to use async/await",
  "context": {
    "file_path": "src/api/client.ts",
    "file_content": "...",
    "selection": { "start": 10, "end": 25 },
    "language": "typescript"
  },
  "workspace_path": "/home/user/my-project",
  "conversation_id": "uuid"
}
```

**Stream Response (SSE):**
```
event: agent_start
data: {"agent": "planner"}

event: token
data: {"content": "I'll break this into..."}

event: agent_start
data: {"agent": "coder"}

event: token
data: {"content": "```typescript\nasync function..."}

event: agent_start
data: {"agent": "reviewer"}

event: token
data: {"content": "The refactored code looks good..."}

event: done
data: {"conversation_id": "uuid"}
```

### POST /complete
```json
{
  "file_path": "src/utils.ts",
  "content_before_cursor": "function calculateTotal(items: Item[]): number {\n  return items.",
  "content_after_cursor": "\n}",
  "language": "typescript",
  "max_tokens": 128
}
```

### POST /index
```json
{
  "workspace_path": "/home/user/my-project",
  "incremental": true,
  "changed_files": ["src/api/client.ts"]
}
```

## Security Considerations
- Backend binds to `127.0.0.1` only — no network exposure
- No authentication needed for local-only deployment (single user)
- For team deployment: add API key authentication via header
- Workspace content never written outside workspace folder
- Model weights stored in Ollama's default location or user-configured path

## Performance Strategy
- **Completions**: Use the 7B model with FIM (fill-in-middle) prompting, 128 max tokens, aggressive timeout (500ms)
- **Chat**: Use the 32B model with streaming, no timeout
- **Indexing**: Background task with progress reporting, chunked processing to avoid blocking
- **Caching**: Cache embeddings for unchanged files, cache recent completions by prefix
