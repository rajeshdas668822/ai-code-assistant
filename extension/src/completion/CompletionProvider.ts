/**
 * Inline completion provider — ghost text powered by the fast 7B model.
 */
import * as vscode from "vscode";
import { BackendClient } from "../backend/BackendClient";
import { Settings } from "../config/Settings";

export class CompletionProvider implements vscode.InlineCompletionItemProvider {
  private backendClient: BackendClient;
  private settings: Settings;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastRequestId = 0;

  constructor(backendClient: BackendClient, settings: Settings) {
    this.backendClient = backendClient;
    this.settings = settings;
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    // Bail if completions are disabled
    if (!this.settings.completionEnabled) {
      return undefined;
    }

    // Cancel any pending debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Debounce: wait for the configured delay before making a request
    const requestId = ++this.lastRequestId;
    await this.delay(this.settings.completionDelay);

    // If a newer request came in during the delay, abort this one
    if (requestId !== this.lastRequestId || token.isCancellationRequested) {
      return undefined;
    }

    // Gather context around the cursor
    const textBeforeCursor = document.getText(
      new vscode.Range(new vscode.Position(0, 0), position)
    );
    const textAfterCursor = document.getText(
      new vscode.Range(position, document.lineAt(document.lineCount - 1).range.end)
    );

    // Limit context size to avoid huge payloads
    const maxContextChars = 4000;
    const contentBefore = textBeforeCursor.slice(-maxContextChars);
    const contentAfter = textAfterCursor.slice(0, maxContextChars);

    try {
      const response = await this.backendClient.complete({
        file_path: document.uri.fsPath,
        content_before_cursor: contentBefore,
        content_after_cursor: contentAfter,
        language: document.languageId,
        max_tokens: this.settings.completionMaxTokens,
      });

      // Check cancellation again after the network call
      if (token.isCancellationRequested || requestId !== this.lastRequestId) {
        return undefined;
      }

      const completionText = response.completion?.trim();
      if (!completionText) {
        return undefined;
      }

      const item = new vscode.InlineCompletionItem(
        completionText,
        new vscode.Range(position, position)
      );

      return [item];
    } catch {
      // Silently fail — don't disrupt the user's typing
      return undefined;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.debounceTimer = setTimeout(resolve, ms);
    });
  }
}
