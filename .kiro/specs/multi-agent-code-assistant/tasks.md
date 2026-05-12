# Implementation Plan: Multi-Agent Code Assistant

## Overview

Build a multi-agent code assistance system delivered as a VS Code extension (TypeScript) backed by a Python FastAPI server with LangGraph orchestration, RAG pipeline, and local LLM integration. Implementation proceeds bottom-up: backend foundations first, then agents, then RAG, then extension, then integration.

## Tasks

- [ ] 1. Set up project structure and core configuration
  - [ ] 1.1 Scaffold the backend Python project
    - Create `backend/` directory structure as defined in design: `app/api/`, `app/agents/`, `app/rag/`, `app/llm/`, `app/prompts/`, `app/state/`
    - Create `backend/pyproject.toml` with dependencies: fastapi, uvicorn, langgraph, langchain-core, chromadb, sentence-transformers, httpx, pydantic
    - Create `backend/requirements.txt` mirroring pyproject.toml deps
    - Add `__init__.py` files to all packages
    - _Requirements: US-1, NFR-4_

  - [ ] 1.2 Scaffold the VS Code extension project
    - Create `extension/` directory structure as defined in design: `src/chat/`, `src/completion/`, `src/actions/`, `src/context/`, `src/backend/`, `src/config/`, `src/status/`
    - Create `extension/package.json` with extension manifest, activation events, contributes (commands, configuration, viewsContainers, views, menus)
    - Create `extension/tsconfig.json` with strict TypeScript config targeting ES2020
    - Add placeholder `extension/src/extension.ts` entry point with `activate` and `deactivate` exports
    - _Requirements: US-2, US-5, US-6_

  - [ ] 1.3 Create shared Pydantic state schemas
    - Implement `backend/app/state/schemas.py` with `AgentState`, `FileContext`, `ReviewResult`, `ChatRequest`, `ChatResponse`, `CompleteRequest`, `CompleteResponse`, `IndexRequest` models as defined in design
    - _Requirements: US-3, US-4_

- [ ] 2. Implement LLM client and model configuration
  - [ ] 2.1 Implement the OpenAI-compatible LLM client
    - Create `backend/app/llm/client.py` with an async LLM client class that talks to any OpenAI-compatible endpoint (Ollama/vLLM)
    - Support both `/v1/chat/completions` (chat) and `/v1/completions` (FIM) endpoints
    - Implement streaming response handling via SSE
    - Add connection validation / health check method
    - _Requirements: US-1, NFR-1_

  - [ ] 2.2 Implement model configuration and registry
    - Create `backend/app/llm/models.py` with model registry mapping agent roles to model configs
    - Support preset configurations: "Fast", "Balanced", "Quality"
    - Define model config schema: endpoint URL, model name, max_tokens, temperature per agent role
    - _Requirements: US-7_

  - [ ]* 2.3 Write unit tests for LLM client
    - Test connection validation, streaming parsing, error handling, timeout behavior
    - Mock the OpenAI-compatible API responses
    - _Requirements: US-1, NFR-1_

- [ ] 3. Implement the multi-agent system
  - [ ] 3.1 Implement the intent router
    - Create `backend/app/agents/router.py` with intent classification logic
    - Classify requests into: code_generation, explanation, debugging, direct_answer
    - Use the LLM client with a classification prompt to determine intent
    - _Requirements: US-3_

  - [ ] 3.2 Implement the Planner agent
    - Create `backend/app/agents/planner.py` as a LangGraph node function
    - Takes user request + RAG context, produces a step-by-step plan
    - Create `backend/app/prompts/planner.md` system prompt
    - Writes `plan` field to AgentState
    - _Requirements: US-3_

  - [ ] 3.3 Implement the Coder agent
    - Create `backend/app/agents/coder.py` as a LangGraph node function
    - Takes plan (or debugger output) + RAG context, generates code
    - Create `backend/app/prompts/coder.md` system prompt
    - Writes `code` field to AgentState
    - _Requirements: US-3_

  - [ ] 3.4 Implement the Reviewer agent
    - Create `backend/app/agents/reviewer.py` as a LangGraph node function
    - Takes generated code, validates for correctness, style, and issues
    - Create `backend/app/prompts/reviewer.md` system prompt
    - Writes `review` (ReviewResult) to AgentState; sets pass/fail + feedback
    - _Requirements: US-3_

  - [ ] 3.5 Implement the Debugger agent
    - Create `backend/app/agents/debugger.py` as a LangGraph node function
    - Activated for error/bug fix requests; analyzes errors and terminal output
    - Create `backend/app/prompts/debugger.md` system prompt
    - Produces diagnosis and fix instructions for the Coder
    - _Requirements: US-3, US-8_

  - [ ] 3.6 Implement the LangGraph workflow graph
    - Create `backend/app/agents/graph.py` defining the full StateGraph
    - Wire nodes: Router → (Planner | DirectAnswer | Debugger) → Coder → Reviewer
    - Add conditional edge from Reviewer back to Coder (max 2 iterations)
    - Implement streaming callbacks to emit `agent_start` and `token` events
    - _Requirements: US-3_

  - [ ]* 3.7 Write unit tests for agent nodes and graph
    - Test router classification for different request types
    - Test graph execution end-to-end with mocked LLM responses
    - Test retry loop terminates after max iterations
    - _Requirements: US-3_

- [ ] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement the RAG pipeline
  - [ ] 5.1 Implement Tree-sitter based code chunker
    - Create `backend/app/rag/chunker.py` using tree-sitter to parse source files
    - Extract functions, classes, and methods as individual chunks
    - Attach metadata per chunk: file_path, symbol_name, language, start_line, end_line
    - Support Python, TypeScript, JavaScript, Java, Go, Rust at minimum
    - _Requirements: US-4_

  - [ ] 5.2 Implement the embedding client
    - Create `backend/app/rag/embeddings.py` wrapping nomic-embed-text via Ollama or sentence-transformers
    - Provide async `embed_texts(texts: list[str]) -> list[list[float]]` interface
    - _Requirements: US-4, NFR-2_

  - [ ] 5.3 Implement the codebase indexer
    - Create `backend/app/rag/indexer.py` orchestrating the full indexing pipeline
    - Walk workspace files respecting `.gitignore`
    - Chunk files → embed chunks → store in ChromaDB
    - Support full and incremental indexing (only changed files)
    - Persist index to `{workspace}/.vscode/agent-index/`
    - Report progress during indexing
    - _Requirements: US-4, NFR-1_

  - [ ] 5.4 Implement hybrid retrieval
    - Create `backend/app/rag/retriever.py` with hybrid search: vector similarity + BM25
    - Implement Reciprocal Rank Fusion to merge results
    - Re-rank by relevance to current file/language
    - Return top 5 chunks with metadata
    - _Requirements: US-4_

  - [ ]* 5.5 Write unit tests for RAG pipeline
    - Test chunker output for sample Python and TypeScript files
    - Test retriever ranking and fusion logic with mock embeddings
    - Test incremental indexing correctly updates only changed files
    - _Requirements: US-4_

- [ ] 6. Implement FastAPI endpoints
  - [ ] 6.1 Implement the health check endpoint
    - Create `backend/app/api/health.py` with `GET /health`
    - Check LLM server connectivity and return status
    - _Requirements: US-1, US-7_

  - [ ] 6.2 Implement the chat endpoint with SSE streaming
    - Create `backend/app/api/chat.py` with `POST /chat`
    - Accept ChatRequest, invoke the LangGraph workflow, stream SSE events (agent_start, token, done)
    - Include conversation_id for session tracking
    - _Requirements: US-2, US-3_

  - [ ] 6.3 Implement the completion endpoint
    - Create `backend/app/api/complete.py` with `POST /complete`
    - Accept CompleteRequest with cursor context, call the fast 7B model with FIM prompting
    - Enforce 500ms timeout, return partial result on timeout
    - _Requirements: US-6, NFR-1_

  - [ ] 6.4 Implement the indexing endpoint
    - Create `backend/app/api/index.py` with `POST /index`
    - Accept IndexRequest, trigger full or incremental indexing as a background task
    - Return indexing status/progress
    - _Requirements: US-4_

  - [ ] 6.5 Wire all routers into FastAPI app
    - Update `backend/app/main.py` to include all API routers
    - Configure CORS for localhost, bind to 127.0.0.1
    - Add startup event to initialize LLM client and ChromaDB
    - _Requirements: NFR-3_

  - [ ]* 6.6 Write unit tests for API endpoints
    - Test chat endpoint streaming with mocked agent graph
    - Test completion endpoint timeout behavior
    - Test health endpoint with reachable and unreachable model server
    - _Requirements: US-1, US-2, US-6_

- [ ] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement VS Code extension — Backend client and config
  - [x] 8.1 Implement extension settings management
    - Create `extension/src/config/Settings.ts`
    - Define configuration schema: inference endpoint URL, model assignments per agent, completion trigger delay, max tokens, toggle flags
    - Read from VS Code workspace/user settings
    - _Requirements: US-1, US-7_

  - [x] 8.2 Implement the backend HTTP/WebSocket client
    - Create `extension/src/backend/BackendClient.ts`
    - Methods: `chat(request)`, `complete(request)`, `triggerIndex(request)`, `healthCheck()`
    - HTTP for request/response endpoints, WebSocket/SSE for streaming chat
    - _Requirements: US-1, US-2_

  - [x] 8.3 Implement the SSE stream handler
    - Create `extension/src/backend/StreamHandler.ts`
    - Parse SSE events (agent_start, token, done) and emit typed callbacks
    - Handle connection errors and reconnection
    - _Requirements: US-2_

  - [x] 8.4 Implement status bar items
    - Create `extension/src/status/StatusBar.ts`
    - Show model connection status (connected/disconnected)
    - Show completion toggle (on/off)
    - Show active agent name during chat
    - _Requirements: US-1, US-7_

- [x] 9. Implement VS Code extension — Chat UI
  - [x] 9.1 Implement the Chat Webview provider
    - Create `extension/src/chat/ChatViewProvider.ts` implementing `WebviewViewProvider`
    - Register as a sidebar view
    - Handle message passing between webview and extension
    - _Requirements: US-2_

  - [x] 9.2 Create the chat webview HTML/CSS/JS
    - Create `extension/src/chat/chatWebview.html`
    - Message input with send button, conversation history display
    - Markdown rendering for responses (code blocks, lists)
    - Show active agent indicator per message
    - Streaming token display (append tokens as they arrive)
    - _Requirements: US-2_

  - [x] 9.3 Wire chat UI to backend client
    - Connect ChatViewProvider to BackendClient for sending messages
    - Pass current file context (path, content, selection, language) with each request
    - Preserve conversation history within session
    - _Requirements: US-2_

- [x] 10. Implement VS Code extension — Code completions
  - [x] 10.1 Implement the inline completion provider
    - Create `extension/src/completion/CompletionProvider.ts` implementing `InlineCompletionItemProvider`
    - Collect context: content before/after cursor, file path, language
    - Call BackendClient.complete() with debouncing (configurable delay)
    - Return ghost text completion items
    - _Requirements: US-6, NFR-1_

- [x] 11. Implement VS Code extension — Code actions and context
  - [x] 11.1 Implement file context extraction
    - Create `extension/src/context/FileContext.ts`
    - Extract current file path, content, selection range, language ID
    - _Requirements: US-2, US-5_

  - [x] 11.2 Implement Tree-sitter parser for symbol extraction
    - Create `extension/src/context/TreeSitterParser.ts`
    - Use web-tree-sitter (WASM) to parse current file
    - Extract function/class symbols for code lens targets
    - _Requirements: US-5_

  - [x] 11.3 Implement code action provider
    - Create `extension/src/actions/CodeActionProvider.ts`
    - Register context menu actions: Explain, Refactor, Fix, Generate Tests
    - Send selected code + action type to chat backend
    - Display results in chat panel or as inline diff
    - _Requirements: US-5_

  - [x] 11.4 Implement code lens provider
    - Create `extension/src/actions/CodeLensProvider.ts`
    - Show action lenses on functions/classes (Explain | Refactor | Test)
    - Trigger agent actions on click
    - _Requirements: US-5_

- [x] 12. Implement VS Code extension — Entry point and activation
  - [x] 12.1 Implement extension activation and registration
    - Update `extension/src/extension.ts` to register all providers: ChatViewProvider, CompletionProvider, CodeActionProvider, CodeLensProvider
    - Register commands for all actions
    - Validate backend connectivity on activation, show error if unreachable
    - Trigger initial codebase indexing on workspace open
    - _Requirements: US-1, US-2, US-4, US-5, US-6_

- [x] 13. Implement terminal and diagnostics integration
  - [x] 13.1 Add terminal output reading to the extension
    - Read current VS Code terminal output and send to chat on user action
    - Access VS Code Problems panel diagnostics
    - Add "Send to Assistant" button/command for terminal output
    - _Requirements: US-8_

  - [x] 13.2 Wire diagnostics into the Debugger agent
    - Pass terminal output and diagnostics as context to the Debugger agent via the chat endpoint
    - Debugger agent automatically suggests fixes when error context is present
    - _Requirements: US-8_

- [ ] 14. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Integration and final wiring
  - [ ] 15.1 End-to-end integration: chat flow
    - Verify full flow: extension chat UI → BackendClient → FastAPI /chat → LangGraph agents → SSE stream → chat UI display
    - Ensure agent transitions (Planner → Coder → Reviewer) are visible in the UI
    - _Requirements: US-2, US-3_

  - [ ] 15.2 End-to-end integration: completion flow
    - Verify: typing in editor → CompletionProvider → BackendClient → /complete → ghost text
    - Ensure debouncing and 500ms timeout work correctly
    - _Requirements: US-6, NFR-1_

  - [ ] 15.3 End-to-end integration: RAG indexing flow
    - Verify: workspace open → trigger /index → indexer processes files → retriever returns relevant chunks during chat
    - Verify incremental re-indexing on file save
    - _Requirements: US-4_

  - [ ]* 15.4 Write integration tests for key flows
    - Test chat flow end-to-end with mocked LLM
    - Test completion flow with timeout enforcement
    - Test indexing + retrieval round-trip
    - _Requirements: US-2, US-3, US-4, US-6_

- [ ] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Backend (Python) and extension (TypeScript) can be developed in parallel after task 1
- The extension never talks to the LLM directly — all communication goes through the FastAPI backend
