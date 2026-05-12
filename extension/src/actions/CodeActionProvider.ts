/**
 * Code action provider — context menu actions: Explain, Refactor, Fix, Generate Tests.
 */
import * as vscode from "vscode";
import { ChatViewProvider } from "../chat/ChatViewProvider";

export type AgentAction = "explain" | "refactor" | "fix" | "generateTests";

const ACTION_PROMPTS: Record<AgentAction, (code: string) => string> = {
  explain: (code) =>
    `Explain the following code clearly and concisely:\n\n\`\`\`\n${code}\n\`\`\``,
  refactor: (code) =>
    `Refactor the following code to improve readability, performance, and maintainability:\n\n\`\`\`\n${code}\n\`\`\``,
  fix: (code) =>
    `Find and fix any bugs or issues in the following code:\n\n\`\`\`\n${code}\n\`\`\``,
  generateTests: (code) =>
    `Generate comprehensive unit tests for the following code:\n\n\`\`\`\n${code}\n\`\`\``,
};

export class CodeActionProvider implements vscode.CodeActionProvider {
  private chatProvider: ChatViewProvider;

  static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.RefactorRewrite,
    vscode.CodeActionKind.QuickFix,
  ];

  constructor(chatProvider: ChatViewProvider) {
    this.chatProvider = chatProvider;
  }

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    _context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] | undefined {
    // Only show actions when there's a selection
    if (range.isEmpty) {
      return undefined;
    }

    const actions: vscode.CodeAction[] = [
      this.createAction("Explain", "agent.explain", range),
      this.createAction("Refactor", "agent.refactor", range),
      this.createAction("Fix", "agent.fix", range),
      this.createAction("Generate Tests", "agent.generateTests", range),
    ];

    return actions;
  }

  private createAction(
    title: string,
    command: string,
    range: vscode.Range
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `Agent: ${title}`,
      vscode.CodeActionKind.RefactorRewrite
    );
    action.command = {
      command,
      title,
      arguments: [range],
    };
    return action;
  }

  /**
   * Execute an agent action on the selected code.
   * Called by the registered commands.
   */
  executeAction(action: AgentAction, range?: vscode.Range): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("No active editor.");
      return;
    }

    const targetRange = range ?? editor.selection;
    if (targetRange.isEmpty) {
      vscode.window.showWarningMessage(
        "Select some code first to use agent actions."
      );
      return;
    }

    const selectedText = editor.document.getText(targetRange);
    const prompt = ACTION_PROMPTS[action](selectedText);

    // Send to chat panel
    this.chatProvider.sendMessage(prompt);

    // Reveal the chat panel
    vscode.commands.executeCommand("agentChat.focus");
  }
}

/**
 * Register all agent action commands.
 * Returns disposables to be added to the extension context.
 */
export function registerActionCommands(
  provider: CodeActionProvider
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand("agent.explain", (range?: vscode.Range) => {
      provider.executeAction("explain", range);
    }),
    vscode.commands.registerCommand("agent.refactor", (range?: vscode.Range) => {
      provider.executeAction("refactor", range);
    }),
    vscode.commands.registerCommand("agent.fix", (range?: vscode.Range) => {
      provider.executeAction("fix", range);
    }),
    vscode.commands.registerCommand(
      "agent.generateTests",
      (range?: vscode.Range) => {
        provider.executeAction("generateTests", range);
      }
    ),
  ];
}
