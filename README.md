# Multi-Agent Code Assistant

A production-grade, open-source multi-agent code assistance system delivered as a VS Code extension. Uses multiple specialized AI agents — Planner, Coder, Reviewer, and Debugger — orchestrated via LangGraph, powered entirely by local open-source LLMs.

## Architecture

```
┌─────────────────────────────────────────┐
│  VS Code Extension (TypeScript)         │
│  Chat UI, completions, code actions     │
└──────────────────┬──────────────────────┘
                   │ HTTP / SSE
┌──────────────────▼──────────────────────┐
│  Agent Backend (Python / FastAPI)       │  ← Docker container
│  LangGraph orchestration, RAG pipeline  │
└──────────────────┬──────────────────────┘
                   │ Ollama API
┌──────────────────▼──────────────────────┐
│  Ollama (Model Serving)                 │  ← Docker container
│  Qwen2.5-Coder, nomic-embed-text       │
└─────────────────────────────────────────┘
```

## Features

- **Multi-agent pipeline**: Planner → Coder → Reviewer with automatic retry loops
- **RAG-powered codebase awareness**: Tree-sitter chunking + ChromaDB + hybrid retrieval
- **Chat interface**: Streaming responses with agent visibility in a VS Code sidebar
- **Inline completions**: Ghost text powered by a fast 7B model with FIM prompting
- **Code actions**: Explain, Refactor, Fix, Generate Tests via context menu and code lens
- **Terminal integration**: Send terminal output and diagnostics to the assistant
- **Fully local**: All processing on your machine — no cloud, no API keys required
- **Dockerized**: One-command startup with Docker Compose

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | TypeScript, VS Code Extension API, web-tree-sitter |
| Backend | Python 3.13, FastAPI, LangGraph, ChromaDB |
| Models | Qwen2.5-Coder-32B (chat), Qwen2.5-Coder-7B (completions), nomic-embed-text (embeddings) |
| Serving | Ollama (Docker) |
| Infra | Docker, Docker Compose |

## Prerequisites

- **Docker** and **Docker Compose** (v2) installed and running
- **Node.js 18+** and npm (for the VS Code extension only)
- GPU recommended (RTX 3060+ / 16GB RAM minimum), CPU-only mode supported

> **Note**: You do NOT need Python or Ollama installed locally. Everything runs inside Docker containers.


## Quick Start (Docker)

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd ai-code-assistance
```

### 2. Start all services

**Bash (Git Bash / WSL / Linux / macOS):**
```bash
./start.sh
```

**PowerShell (Windows):**
```powershell
.\start.ps1
```

This will:
1. Build the backend Docker image
2. Start the Ollama container
3. Start the backend container
4. Wait for Ollama to be healthy
5. Auto-pull the default model (`qwen2.5-coder:7b`)

Once complete, you'll see:
```
=== All services running ===
  Backend:  http://localhost:8000
  Ollama:   http://localhost:11434
  Health:   http://localhost:8000/health
```

### 3. Stop all services

**Bash:**
```bash
./stop.sh
```

**PowerShell:**
```powershell
.\stop.ps1
```

### 4. Use a different model

Pass the `MODEL` environment variable to pull a different model on startup:

**Bash:**
```bash
MODEL=qwen2.5-coder:14b ./start.sh
```

**PowerShell:**
```powershell
$env:MODEL = "qwen2.5-coder:14b"; .\start.ps1
```

### 5. Build and run the VS Code extension

```bash
cd extension
npm install
npm run compile
# Press F5 in VS Code to launch the Extension Development Host
```

## API Endpoints

Once the backend is running, the following endpoints are available:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check — returns server and model status |
| `POST` | `/complete` | Non-streaming code completion (JSON response) |
| `POST` | `/stream` | Streaming code completion (SSE response) |
| `POST` | `/explain` | Streaming code explanation (SSE response) |

### Example: Health Check

```bash
curl http://localhost:8000/health
```

### Example: Code Completion

```bash
curl -X POST http://localhost:8000/complete \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a Python decorator that measures function execution time",
    "model": "qwen2.5-coder:7b",
    "temperature": 0.2
  }'
```

### Example: Streaming

```bash
curl -X POST http://localhost:8000/stream \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a Python decorator that measures function execution time",
    "model": "qwen2.5-coder:7b",
    "temperature": 0.2
  }'
```

## GPU Support

To enable GPU acceleration for Ollama, uncomment the `deploy` section in `docker-compose.yml`:

```yaml
services:
  ollama:
    # ...
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
```

Requires the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) to be installed on the host.

## Local Development (without Docker)

If you prefer running without Docker:

### Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Ollama

Install Ollama from [ollama.com](https://ollama.com), then:

```bash
ollama pull qwen2.5-coder:7b
ollama serve
```

The backend reads `OLLAMA_BASE_URL` from the environment (defaults to `http://localhost:11434`).

## Project Structure

```
├── docker-compose.yml        # Docker Compose — Ollama + Backend
├── start.sh / start.ps1      # Start all services (Docker)
├── stop.sh / stop.ps1        # Stop all services (Docker)
├── backend/                  # Python FastAPI backend
│   ├── Dockerfile            # Backend container image
│   ├── app/
│   │   ├── main.py           # FastAPI entry point
│   │   ├── api/              # HTTP endpoints (chat, complete, index, health)
│   │   ├── agents/           # LangGraph agent nodes and workflow
│   │   ├── rag/              # Indexing, chunking, retrieval, embeddings
│   │   ├── llm/              # LLM client and model config
│   │   ├── prompts/          # Agent system prompts
│   │   └── state/            # Pydantic schemas
│   ├── tests/
│   ├── pyproject.toml
│   └── requirements.txt
├── extension/                # VS Code extension (TypeScript)
│   ├── src/
│   │   ├── extension.ts      # Entry point
│   │   ├── chat/             # Chat webview provider and UI
│   │   ├── completion/       # Inline completion provider
│   │   ├── actions/          # Code actions and code lens
│   │   ├── context/          # File context and Tree-sitter parsing
│   │   ├── backend/          # HTTP/SSE client to Python backend
│   │   ├── config/           # Extension settings
│   │   └── status/           # Status bar items
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL (auto-set in Docker) |
| `MODEL` | `qwen2.5-coder:7b` | Model to pull on startup |

### VS Code Extension Settings

In VS Code `settings.json`:

```json
{
  "multiAgentAssistant.backendUrl": "http://localhost:8000",
  "multiAgentAssistant.completionEnabled": true,
  "multiAgentAssistant.completionDelay": 300,
  "multiAgentAssistant.completionMaxTokens": 128,
  "multiAgentAssistant.modelPreset": "balanced"
}
```

### Model Presets

| Preset | Chat Model | Completion Model | Use Case |
|--------|-----------|-----------------|----------|
| `fast` | qwen2.5-coder:7b | qwen2.5-coder:7b | Low latency, lower quality |
| `balanced` | qwen2.5-coder:14b | qwen2.5-coder:7b | Good balance of speed and quality |
| `quality` | qwen2.5-coder:32b | qwen2.5-coder:7b | Best quality, requires more VRAM |

## Troubleshooting

### "All connection attempts failed"
The backend can't reach Ollama. Check:
- `docker ps` — both containers should be running
- `curl http://localhost:11434/api/tags` — Ollama should respond
- If running locally (no Docker), ensure `ollama serve` is running

### "Model not found"
Pull the model first:
```bash
docker exec ollama ollama pull qwen2.5-coder:7b
```

### Backend container keeps restarting
Check logs:
```bash
docker logs code-assist-backend
```

### Slow responses
- Ensure GPU passthrough is enabled in `docker-compose.yml`
- Use a smaller model (`qwen2.5-coder:7b` instead of `32b`)
- Check `docker stats` for resource usage

## License

MIT
