/**
 * Webview provider for the chat sidebar panel.
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { BackendClient, ChatRequest } from "../backend/BackendClient";
import { StreamCallbacks } from "../backend/StreamHandler";
import { Settings } from "../config/Settings";
import { StatusBar } from "../status/StatusBar";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  agent?: string;
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "agentChat";

  private view?: vscode.WebviewView;
  private messages: ChatMessage[] = [];
  private backendClient: BackendClient;
  private settings: Settings;
  private statusBar: StatusBar;
  private extensionUri: vscode.Uri;
  private cancelStream: (() => void) | null = null;

  constructor(
    extensionUri: vscode.Uri,
    backendClient: BackendClient,
    settings: Settings,
    statusBar: StatusBar
  ) {
    this.extensionUri = extensionUri;
    this.backendClient = backendClient;
    this.settings = settings;
    this.statusBar = statusBar;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlContent();

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case "sendMessage":
          this.handleUserMessage(message.text);
          break;
        case "cancel":
          this.cancelCurrentStream();
          break;
      }
    });
  }

  /**
   * Send a message programmatically (e.g., from code actions).
   */
  public sendMessage(text: string): void {
    this.handleUserMessage(text);
  }

  private handleUserMessage(text: string): void {
    if (!text.trim()) {
      return;
    }

    // Add user message to history
    this.messages.push({ role: "user", content: text });
    this.postToWebview({ type: "addMessage", role: "user", content: text });

    // Get current file context
    const editor = vscode.window.activeTextEditor;
    const context = editor
      ? {
        file_path: editor.document.uri.fsPath,
        file_content: editor.document.getText(),
        selection: editor.selection.isEmpty
          ? undefined
          : {
            start: editor.document.offsetAt(editor.selection.start),
            end: editor.document.offsetAt(editor.selection.end),
          },
        language: editor.document.languageId,
      }
      : undefined;

    const request: ChatRequest = {
      message: text,
      context,
      workspace_path:
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "",
    };

    // Start streaming response
    let assistantContent = "";
    let currentAgent = "";

    const callbacks: StreamCallbacks = {
      onAgentStart: (agent) => {
        currentAgent = agent;
        this.statusBar.showAgent(agent);
        this.postToWebview({ type: "agentStart", agent });
      },
      onToken: (token) => {
        assistantContent += token;
        this.postToWebview({ type: "token", content: token });
      },
      onDone: () => {
        this.messages.push({
          role: "assistant",
          content: assistantContent,
          agent: currentAgent,
        });
        this.statusBar.hideAgent();
        this.postToWebview({ type: "done" });
        this.cancelStream = null;
      },
      onError: (error) => {
        this.statusBar.hideAgent();
        this.postToWebview({
          type: "error",
          content: error.message,
        });
        this.cancelStream = null;
      },
    };

    this.cancelStream = this.backendClient.chat(request, callbacks);
    this.postToWebview({ type: "streamStart" });
  }

  private cancelCurrentStream(): void {
    if (this.cancelStream) {
      this.cancelStream();
      this.cancelStream = null;
      this.statusBar.hideAgent();
      this.postToWebview({ type: "done" });
    }
  }

  private postToWebview(message: unknown): void {
    this.view?.webview.postMessage(message);
  }

  private getHtmlContent(): string {
    const htmlPath = path.join(
      this.extensionUri.fsPath,
      "src",
      "chat",
      "chatWebview.html"
    );
    try {
      return fs.readFileSync(htmlPath, "utf8");
    } catch {
      return this.getFallbackHtml();
    }
  }

  private getFallbackHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Agent Chat</title></head>
<body><p>Error loading chat UI.</p></body>
</html>`;
  }
}
