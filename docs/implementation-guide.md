# Multi-Agent Code Assistant — Implementation Guide (Tasks 8–13)

## What Was Built

Tasks 8 through 13 implement the entire **VS Code extension** — the part that developers interact with. This is the frontend layer that connects to the Python backend (which talks to the AI model). By the end of these tasks, you have a fully wired VS Code extension with a chat panel, inline code completions, context menu actions, code lenses, and terminal/diagnostics integration.

---

## How It All Fits Together (The Big Picture)

```
┌─────────────────────────────────────────────────────────────────┐
│                    VS Code / Kiro Editor                        │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌───────────┐  │
│  │ Chat     │  │ Ghost Text   │  │ Right-    │  │ Code      │  │
│  │ Panel    │  │ Completions  │  │ Click     │  │ Lenses    │  │
│  │ (Task 9) │  │ (Task 10)    │  │ Menu      │  │ (Task 11) │  │
│  │          │  │              │  │ (Task 11) │  │           │  │
│  └────┬─────┘  └──────┬───────┘  └─────┬─────┘  └─────┬─────┘  │
│       │               │               │              │          │
│       └───────┬───────┴───────┬───────┘              │          │
│               │               │                      │          │
│        ┌──────▼──────┐  ┌─────▼──────┐               │          │
│        │ Backend     │  │ Settings   │               │          │
│        │ Client      │  │ (Task 8)   │               │          │
│        │ (Task 8)    │  └────────────┘               │          │
│        └──────┬──────┘                               │          │
│               │                                      │          │
│        ┌──────▼──────┐  ┌────────────────────────┐   │          │
│        │ Stream      │  │ Terminal & Diagnostics  │   │          │
│        │ Handler     │  │ (Task 13)               │   │          │
│        │ (Task 8)    │  └────────────────────────┘   │          │
│        └──────┬──────┘                               │          │
│               │          ┌───────────────────────┐   │          │
│               │          │ Status Bar (Task 8)   │   │          │
│               │          │ Connected | Completions│   │          │
│               │          └───────────────────────┘   │          │
│               │                                      │          │
│  ┌────────────▼──────────────────────────────────────▼────────┐ │
│  │              extension.ts — Entry Point (Task 12)          │ │
│  │     Registers all providers, commands, and listeners       │ │
│  └────────────────────────────┬───────────────────────────────┘ │
└───────────────────────────────┼─────────────────────────────────┘
                                │
                    HTTP / SSE (port 8000)
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│              Python Backend (FastAPI)                            │
│              /health  /stream  /complete  /explain               │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                    HTTP (port 11434)
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│              Ollama (AI Model Server)                            │
│              qwen2.5-coder:7b                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Complete Chat Flow (Step by Step)

Here is exactly what happens when you type "Write a hello world function" in the chat panel and press Enter:

### Step 1: User types a message in the Chat Panel
- The chat panel is an HTML page (`chatWebview.html`) running inside a VS Code sidebar
- When you press Enter or click Send, the HTML page sends a message to the extension:
  ```
  User types: "Write a hello world function"
  → chatWebview.html sends: { type: "sendMessage", text: "Write a hello world function" }
  ```

### Step 2: ChatViewProvider receives the message
- `ChatViewProvider.ts` listens for messages from the webview
- It collects **context** about what you're currently working on:
  - Which file is open
  - What code is selected (if any)
  - What programming language the file is
- It adds your message to the conversation history
- It tells the webview to display your message in the chat

### Step 3: BackendClient sends the request to the Python backend
- `BackendClient.ts` creates an HTTP POST request to `http://127.0.0.1:8000/stream`
- The request body looks like:
  ```json
  {
    "prompt": "Write a hello world function",
    "model": "qwen2.5-coder:7b",
    "temperature": 0.2
  }
  ```
- The request uses **Server-Sent Events (SSE)** — this means the server sends back data piece by piece instead of all at once (so you see the response appear word by word)

### Step 4: FastAPI backend receives the request
- `main.py` receives the POST at `/stream`
- It calls `stream_completion()` from `client.py`
- This function connects to Ollama at `http://localhost:11434/api/chat`

### Step 5: Ollama generates the response
- Ollama loads the `qwen2.5-coder:7b` model (if not already loaded)
- It generates text token by token
- Each token is sent back to the FastAPI backend as a JSON line:
  ```json
  {"message": {"content": "def"}, "done": false}
  {"message": {"content": " hello"}, "done": false}
  {"message": {"content": "_world"}, "done": false}
  ...
  {"message": {"content": ""}, "done": true}
  ```

### Step 6: FastAPI streams tokens back to the extension
- The backend wraps each token in SSE format and sends it to the extension:
  ```
  data: {"token": "def"}

  data: {"token": " hello"}

  data: {"token": "_world"}

  data: {"token": "():"}

  data: [DONE]
  ```

### Step 7: StreamHandler parses the SSE events
- `StreamHandler.ts` receives the raw text stream
- It parses each `data:` line and extracts the token
- For each token, it calls the `onToken` callback
- When it sees `[DONE]`, it calls the `onDone` callback

### Step 8: ChatViewProvider updates the chat UI
- Each token callback sends a message to the webview:
  ```
  { type: "token", content: "def" }
  { type: "token", content: " hello" }
  ```
- The webview appends each token to the current message bubble
- You see the response appear word by word in real time
- When done, the full text is re-rendered with markdown formatting (code blocks, bold, etc.)

### Step 9: Status bar updates
- While the AI is generating, the status bar shows a spinning indicator with the agent name
- When done, the indicator disappears

---

## Task-by-Task Breakdown

### Task 8: Backend Client and Configuration

**What it does:** Provides the plumbing that connects the extension to the backend server.

**Files created:**

| File | Purpose |
|------|---------|
| `Settings.ts` | Reads extension settings from VS Code (backend URL, model preset, completion delay, etc.) |
| `BackendClient.ts` | Makes HTTP requests to the Python backend (health check, completions, streaming chat) |
| `StreamHandler.ts` | Parses Server-Sent Events (SSE) — the streaming format the backend uses to send tokens one at a time |
| `StatusBar.ts` | Shows connection status, completion toggle, and active agent in the VS Code bottom bar |

**How Settings work:**
- You configure the extension in VS Code Settings (Ctrl+,)
- Settings include: backend URL, whether completions are on/off, typing delay before completions trigger, and which model preset to use
- Three presets: "fast" (7B model, quick but less smart), "balanced" (7B for now), "quality" (32B, smartest but needs more GPU)

**How the Backend Client works:**
- `healthCheck()` → GET `/health` → checks if the backend is running
- `complete()` → POST `/complete` → sends code context, gets back a completion
- `chat()` → POST `/stream` → sends a message, receives tokens one by one via SSE
- `triggerIndex()` → POST `/index` → tells the backend to index the codebase for search

---

### Task 9: Chat UI

**What it does:** Creates the chat panel where you talk to the AI assistant.

**Files created:**

| File | Purpose |
|------|---------|
| `ChatViewProvider.ts` | The bridge between VS Code and the chat HTML page. Handles sending messages, receiving responses, and managing conversation history |
| `chatWebview.html` | The actual chat interface — HTML, CSS, and JavaScript that renders messages, handles input, and displays streaming responses |

**Chat UI features:**
- Message input with auto-resizing textarea
- Enter to send, Shift+Enter for new line
- Streaming display — tokens appear one by one as the AI generates them
- Agent badges — shows which AI agent is responding (Planner, Coder, Reviewer)
- Markdown rendering — code blocks, bold, italic are formatted properly
- Stop button — cancel a response mid-generation
- Error display — shows clear error messages if something goes wrong
- VS Code theme-aware — colors match your editor theme (dark/light)

---

### Task 10: Code Completions

**What it does:** Provides "ghost text" suggestions as you type, similar to GitHub Copilot.

**Files created:**

| File | Purpose |
|------|---------|
| `CompletionProvider.ts` | Watches your typing and requests completions from the backend |

**How it works:**
1. You pause typing for 300ms (configurable)
2. The provider grabs the code before and after your cursor (up to 4000 characters each)
3. It sends this to `POST /complete` on the backend
4. The backend asks the AI model to predict what comes next
5. The suggestion appears as faded "ghost text" that you can accept with Tab

**Smart features:**
- Debouncing — waits for you to stop typing before making a request (avoids flooding the server)
- Deduplication — if you keep typing, older requests are automatically cancelled
- Respects the on/off toggle in the status bar
- Silently fails — if the backend is down, you just don't see suggestions (no error popups)

---

### Task 11: Code Actions and Context

**What it does:** Adds right-click menu actions and inline code lenses for interacting with the AI.

**Files created:**

| File | Purpose |
|------|---------|
| `FileContext.ts` | Extracts information about the current file — path, content, selected text, language |
| `TreeSitterParser.ts` | Finds functions and classes in your code for code lens placement |
| `CodeActionProvider.ts` | Adds "Agent: Explain / Refactor / Fix / Generate Tests" to the right-click menu |
| `CodeLensProvider.ts` | Shows clickable "Explain | Refactor | Test" links above each function |

**Right-click menu (Code Actions):**
1. Select some code in the editor
2. Right-click → see "Agent: Explain", "Agent: Refactor", "Agent: Fix", "Agent: Generate Tests"
3. Click one → it builds a prompt with your selected code and sends it to the chat panel
4. The AI responds in the chat panel

**Code Lenses:**
- Small clickable text that appears above every function and class
- Shows: `Explain | Refactor | Test`
- Click any of them → sends that function's code to the chat with the appropriate prompt
- Updates automatically when you edit the file

---

### Task 12: Extension Entry Point

**What it does:** Wires everything together. This is the "main" function of the extension.

**Files created:**

| File | Purpose |
|------|---------|
| `extension.ts` | Registers all providers, commands, and listeners when the extension starts |

**What happens when the extension activates:**
1. Creates Settings, BackendClient, and StatusBar instances
2. Registers the chat sidebar panel
3. Registers the inline completion provider (ghost text)
4. Registers code action provider (right-click menu)
5. Registers code lens provider (inline links above functions)
6. Registers all commands (explain, refactor, fix, test, toggle completions, check health, send terminal, send diagnostics)
7. Shows the status bar
8. Checks if the backend is reachable (updates status bar accordingly)
9. Triggers initial codebase indexing

---

### Task 13: Terminal and Diagnostics Integration

**What it does:** Lets the AI help you fix errors from the terminal and the Problems panel.

**Files created:**

| File | Purpose |
|------|---------|
| `DiagnosticsContext.ts` | Reads errors/warnings from VS Code's Problems panel and captures terminal text |

**Features:**

**"Send Terminal to Chat" command:**
1. Select text in the VS Code terminal (e.g., an error message)
2. Run command "Agent: Send Terminal to Chat" (Ctrl+Shift+P)
3. The selected text is sent to the chat with a "help me fix this" prompt
4. The AI analyzes the error and suggests a fix

**"Send Diagnostics to Chat" command:**
1. When your code has red squiggly errors
2. Run command "Agent: Send Diagnostics to Chat"
3. All errors for the current file are collected and sent to the chat
4. The AI reads the error messages and suggests fixes

**Auto-suggest on errors:**
- When new errors appear in your code, a notification pops up: "3 error(s) detected. Send to Agent?"
- Click "Fix with Agent" → errors are sent to the chat automatically
- Debounced by 3 seconds so it doesn't spam you while you're still typing

---

## File Map (All Extension Files)

```
extension/
├── .vscode/
│   ├── launch.json              # F5 debug configuration
│   └── tasks.json               # Build task for compilation
├── src/
│   ├── extension.ts             # ENTRY POINT — wires everything together
│   ├── config/
│   │   └── Settings.ts          # Reads VS Code settings (URL, model, delays)
│   ├── backend/
│   │   ├── BackendClient.ts     # HTTP client — talks to Python backend
│   │   └── StreamHandler.ts     # Parses SSE streaming responses
│   ├── chat/
│   │   ├── ChatViewProvider.ts  # Chat panel logic (send/receive messages)
│   │   └── chatWebview.html     # Chat UI (HTML/CSS/JS)
│   ├── completion/
│   │   └── CompletionProvider.ts # Ghost text inline completions
│   ├── actions/
│   │   ├── CodeActionProvider.ts # Right-click menu actions
│   │   └── CodeLensProvider.ts  # Inline "Explain|Refactor|Test" links
│   ├── context/
│   │   ├── FileContext.ts       # Extracts current file info
│   │   ├── TreeSitterParser.ts  # Finds functions/classes in code
│   │   └── DiagnosticsContext.ts # Reads errors and terminal output
│   └── status/
│       └── StatusBar.ts         # Bottom bar indicators
├── package.json                 # Extension manifest (commands, settings, menus)
└── tsconfig.json                # TypeScript configuration
```

---

## Summary

| Task | What | User Sees |
|------|------|-----------|
| 8 | Backend client + config | Status bar showing "Connected/Disconnected", settings in VS Code |
| 9 | Chat UI | Sidebar chat panel with streaming AI responses |
| 10 | Completions | Ghost text suggestions while typing |
| 11 | Code actions + lenses | Right-click menu + "Explain\|Refactor\|Test" above functions |
| 12 | Entry point | Everything starts working when the extension loads |
| 13 | Terminal + diagnostics | "Send to Agent" for errors and terminal output |
