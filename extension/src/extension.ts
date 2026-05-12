/**
 * Multi-Agent Code Assistant — VS Code Extension Entry Point
 */
import * as vscode from "vscode";
import {
  CodeActionProvider,
  registerActionCommands,
} from "./actions/CodeActionProvider";
import { CodeLensProvider } from "./actions/CodeLensProvider";
import { BackendClient } from "./backend/BackendClient";
import { ChatViewProvider } from "./chat/ChatViewProvider";
import { CompletionProvider } from "./completion/CompletionProvider";
import { Settings } from "./config/Settings";
import {
  formatDiagnosticsForAgent,
  getDiagnostics,
  getTerminalSelection,
} from "./context/DiagnosticsContext";
import { StatusBar } from "./status/StatusBar";

export function activate(context: vscode.ExtensionContext) {
  // Core services
  const settings = new Settings();
  const backendClient = new BackendClient(settings);
  const statusBar = new StatusBar(settings);

  // Chat view provider
  const chatProvider = new ChatViewProvider(
    context.extensionUri,
    backendClient,
    settings,
    statusBar
  );

  // Register the chat sidebar webview
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      chatProvider
    )
  );

  // Register inline completion provider
  const completionProvider = new CompletionProvider(backendClient, settings);
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { pattern: "**" },
      completionProvider
    )
  );

  // Register code action provider (context menu)
  const codeActionProvider = new CodeActionProvider(chatProvider);
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { pattern: "**" },
      codeActionProvider,
      {
        providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds,
      }
    )
  );

  // Register code lens provider
  const codeLensProvider = new CodeLensProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { pattern: "**" },
      codeLensProvider
    )
  );

  // Register agent action commands
  const actionCommands = registerActionCommands(codeActionProvider);
  context.subscriptions.push(...actionCommands);

  // Register utility commands
  context.subscriptions.push(
    vscode.commands.registerCommand("agent.toggleCompletion", async () => {
      const enabled = await settings.toggleCompletion();
      statusBar.updateCompletionToggle();
      vscode.window.showInformationMessage(
        `Inline completions ${enabled ? "enabled" : "disabled"}.`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("agent.checkHealth", async () => {
      try {
        await backendClient.healthCheck();
        statusBar.updateConnectionStatus(true);
        vscode.window.showInformationMessage("Backend is connected.");
      } catch (err) {
        statusBar.updateConnectionStatus(false);
        const message =
          err instanceof Error ? err.message : "Unknown error";
        vscode.window.showErrorMessage(
          `Cannot reach backend: ${message}`
        );
      }
    })
  );

  // Show status bar
  statusBar.show();
  context.subscriptions.push({ dispose: () => statusBar.dispose() });

  // Settings change listener
  context.subscriptions.push(
    settings.onDidChange(() => {
      statusBar.updateCompletionToggle();
    })
  );

  // Validate backend connectivity on activation
  backendClient
    .healthCheck()
    .then(() => {
      statusBar.updateConnectionStatus(true);
    })
    .catch(() => {
      statusBar.updateConnectionStatus(false);
    });

  // Trigger initial codebase indexing
  const workspacePath =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspacePath) {
    backendClient
      .triggerIndex({ workspace_path: workspacePath, incremental: false })
      .catch(() => {
        // Indexing failed silently — backend may not be ready yet
      });
  }

  // Terminal & Diagnostics commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "agent.sendTerminalToChat",
      async () => {
        const terminalText = await getTerminalSelection();
        if (!terminalText) {
          vscode.window.showWarningMessage(
            "No terminal text selected. Select text in the terminal first."
          );
          return;
        }
        const prompt = `I'm seeing this terminal output. Help me understand and fix any issues:\n\n\`\`\`\n${terminalText}\n\`\`\``;
        chatProvider.sendMessage(prompt);
        vscode.commands.executeCommand("agentChat.focus");
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("agent.sendDiagnosticsToChat", () => {
      const editor = vscode.window.activeTextEditor;
      const diagnostics = getDiagnostics(editor?.document.uri);
      if (diagnostics.length === 0) {
        vscode.window.showInformationMessage("No diagnostics found.");
        return;
      }
      const formatted = formatDiagnosticsForAgent(diagnostics);
      const prompt = `I have the following errors/warnings in my code. Help me fix them:\n\n\`\`\`\n${formatted}\n\`\`\``;
      chatProvider.sendMessage(prompt);
      vscode.commands.executeCommand("agentChat.focus");
    })
  );

  // Auto-suggest fixes when errors appear (debounced)
  let diagnosticDebounce: ReturnType<typeof setTimeout> | undefined;
  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics((e) => {
      if (diagnosticDebounce) {
        clearTimeout(diagnosticDebounce);
      }
      diagnosticDebounce = setTimeout(() => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }
        const errors = getDiagnostics(editor.document.uri).filter(
          (d) => d.severity === "error"
        );
        if (errors.length > 0) {
          // Show a non-intrusive notification with option to send to agent
          vscode.window
            .showInformationMessage(
              `${errors.length} error(s) detected. Send to Agent?`,
              "Fix with Agent"
            )
            .then((choice) => {
              if (choice === "Fix with Agent") {
                vscode.commands.executeCommand(
                  "agent.sendDiagnosticsToChat"
                );
              }
            });
        }
      }, 3000); // Wait 3s after diagnostics settle
    })
  );

  console.log("Multi-Agent Code Assistant is now active");
}

export function deactivate() {
  // Cleanup handled by disposables
}
