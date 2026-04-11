# Multi-Agent Code Assistant — Requirements

## Overview
Build a production-grade, open-source multi-agent code assistance system delivered as a VS Code extension. The system uses multiple specialized AI agents orchestrated to provide intelligent code assistance — planning, writing, reviewing, and debugging code — powered entirely by open-source LLMs.

## Goals
- Provide a Kiro-like code assistance experience using only open-source models and frameworks
- Achieve production-grade latency and reliability for real-world developer workflows
- Support multi-agent collaboration where specialized agents handle different tasks
- Enable RAG-based codebase awareness so agents understand project context
- Ship as a VS Code extension with a clean, intuitive UX

## User Stories

### US-1: Local Model Setup
As a developer, I want to connect the extension to a locally running LLM (via Ollama or vLLM) so that I can use the assistant without any cloud dependency or API keys.

**Acceptance Criteria:**
- Extension settings allow configuring the inference endpoint URL
- Extension validates connectivity to the model server on activation
- Supports any OpenAI-compatible API endpoint
- Shows clear error messages when the model server is unreachable
- Default configuration works with Ollama out of the box

### US-2: Chat Interface
As a developer, I want a chat panel in VS Code where I can ask questions about my code and get intelligent responses from the multi-agent system.

**Acceptance Criteria:**
- Side panel chat UI with message input and conversation history
- Supports markdown rendering in responses (code blocks, lists, etc.)
- Shows which agent is currently responding (Planner, Coder, Reviewer, etc.)
- Supports streaming responses for real-time feedback
- Chat context includes the currently open file and selection
- Conversation history is preserved within a session

### US-3: Multi-Agent Task Execution
As a developer, I want the system to automatically route my request through specialized agents (Planner → Coder → Reviewer) so that I get well-thought-out, reviewed code suggestions.

**Acceptance Criteria:**
- Planner agent breaks down the request into actionable steps
- Coder agent generates code based on the plan
- Reviewer agent validates the generated code for correctness, style, and potential issues
- Agent pipeline is visible to the user (which agent is active, what each produced)
- User can intervene or redirect at any stage
- Debugger agent activates when errors are detected

### US-4: Codebase-Aware Context (RAG)
As a developer, I want the assistant to understand my entire codebase, not just the open file, so that suggestions are contextually relevant.

**Acceptance Criteria:**
- On workspace open, the extension indexes the codebase into a vector store
- Incremental re-indexing on file save/create/delete
- Agents retrieve relevant code snippets before generating responses
- Respects .gitignore for indexing exclusions
- Embedding model runs locally (no cloud dependency)
- Index persists across sessions (stored in .vscode or workspace folder)

### US-5: Inline Code Actions
As a developer, I want to trigger agent actions directly from the editor (explain, refactor, fix, generate tests) via code actions or context menu.

**Acceptance Criteria:**
- Right-click context menu with agent actions: Explain, Refactor, Fix, Generate Tests
- Code lens actions on functions/classes for quick access
- Selected code is sent as context to the appropriate agent
- Results can be applied as inline diffs or shown in the chat panel
- Supports undo for any applied changes

### US-6: Code Completions
As a developer, I want inline code completions powered by the local model so I get intelligent suggestions as I type.

**Acceptance Criteria:**
- Inline ghost text completions triggered on pause or Tab
- Completions are context-aware (current file + imports + relevant codebase context)
- Debounced requests to avoid overwhelming the model server
- Configurable trigger delay and max tokens
- Can be toggled on/off from status bar

### US-7: Model Configuration & Switching
As a developer, I want to configure which models are used for which agents so I can optimize for speed vs. quality.

**Acceptance Criteria:**
- Settings UI to assign models to agents (e.g., small model for completions, large model for planning)
- Preset configurations (e.g., "Fast", "Balanced", "Quality")
- Support for multiple simultaneous model endpoints
- Model health check and status display in the extension

### US-8: Terminal & Diagnostics Integration
As a developer, I want the assistant to read terminal output and VS Code diagnostics so it can help me fix build errors and test failures.

**Acceptance Criteria:**
- Agent can read current terminal output when asked
- Agent can access VS Code Problems panel diagnostics
- Debugger agent automatically suggests fixes for errors
- User can send terminal output to chat with one click

## Non-Functional Requirements

### NFR-1: Performance
- Code completions must return within 500ms for acceptable UX
- Chat responses must begin streaming within 2 seconds
- Codebase indexing must complete within 60 seconds for projects up to 100K LOC
- Extension activation must not add more than 1 second to VS Code startup

### NFR-2: Resource Usage
- Extension backend should work on machines with 16GB RAM + consumer GPU (RTX 3060 or equivalent)
- CPU-only mode must be supported (with degraded performance)
- Memory usage of the extension process itself should stay under 500MB

### NFR-3: Security & Privacy
- All processing happens locally — no data leaves the machine by default
- No telemetry without explicit opt-in
- Workspace content is never persisted outside the workspace folder
- Model weights are stored in user-configurable locations

### NFR-4: Extensibility
- Plugin architecture for adding new agents
- MCP (Model Context Protocol) support for external tool integration
- Custom prompt templates per agent
- API for other extensions to interact with the agent system
