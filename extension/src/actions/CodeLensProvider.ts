/**
 * Code lens provider — inline action lenses on functions/classes.
 * Shows "Explain | Refactor | Test" above each function/class definition.
 */
import * as vscode from "vscode";
import { extractSymbols } from "../context/TreeSitterParser";

export class CodeLensProvider implements vscode.CodeLensProvider {
  private onDidChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this.onDidChangeEmitter.event;

  constructor() {
    // Refresh code lenses when the document changes
    vscode.workspace.onDidChangeTextDocument(() => {
      this.onDidChangeEmitter.fire();
    });
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    const lenses: vscode.CodeLens[] = [];

    const symbols = await extractSymbols(document);

    for (const symbol of symbols) {
      const range = new vscode.Range(
        symbol.range.start,
        symbol.range.start
      );

      // Explain lens
      lenses.push(
        new vscode.CodeLens(range, {
          title: "$(lightbulb) Explain",
          command: "agent.explain",
          arguments: [symbol.range],
          tooltip: `Ask the agent to explain ${symbol.name}`,
        })
      );

      // Refactor lens
      lenses.push(
        new vscode.CodeLens(range, {
          title: "$(edit) Refactor",
          command: "agent.refactor",
          arguments: [symbol.range],
          tooltip: `Ask the agent to refactor ${symbol.name}`,
        })
      );

      // Generate Tests lens (only for functions and methods)
      if (symbol.kind === "function" || symbol.kind === "method") {
        lenses.push(
          new vscode.CodeLens(range, {
            title: "$(beaker) Test",
            command: "agent.generateTests",
            arguments: [symbol.range],
            tooltip: `Generate tests for ${symbol.name}`,
          })
        );
      }
    }

    return lenses;
  }
}
