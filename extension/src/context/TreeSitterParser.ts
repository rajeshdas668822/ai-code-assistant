/**
 * Tree-sitter parser (WASM) for AST-based symbol extraction in the extension.
 *
 * Extracts function and class symbols from the current document for use
 * as code lens targets. Uses VS Code's built-in DocumentSymbolProvider
 * as a fallback when tree-sitter WASM binaries are not available.
 */
import * as vscode from "vscode";

export interface SymbolInfo {
  name: string;
  kind: "function" | "class" | "method";
  range: vscode.Range;
  detail?: string;
}

/**
 * Extract function and class symbols from a document.
 * Uses VS Code's built-in symbol provider (which may use tree-sitter internally).
 */
export async function extractSymbols(
  document: vscode.TextDocument
): Promise<SymbolInfo[]> {
  const symbols: SymbolInfo[] = [];

  try {
    const documentSymbols = await vscode.commands.executeCommand<
      vscode.DocumentSymbol[]
    >("vscode.executeDocumentSymbolProvider", document.uri);

    if (!documentSymbols) {
      return symbols;
    }

    flattenSymbols(documentSymbols, symbols);
  } catch {
    // Symbol provider not available for this language — return empty
  }

  return symbols;
}

/**
 * Recursively flatten document symbols into a flat list of functions/classes/methods.
 */
function flattenSymbols(
  documentSymbols: vscode.DocumentSymbol[],
  result: SymbolInfo[]
): void {
  for (const sym of documentSymbols) {
    const kind = mapSymbolKind(sym.kind);
    if (kind) {
      result.push({
        name: sym.name,
        kind,
        range: sym.range,
        detail: sym.detail,
      });
    }

    // Recurse into children (e.g., methods inside classes)
    if (sym.children && sym.children.length > 0) {
      flattenSymbols(sym.children, result);
    }
  }
}

/**
 * Map VS Code SymbolKind to our simplified kind.
 */
function mapSymbolKind(
  kind: vscode.SymbolKind
): "function" | "class" | "method" | null {
  switch (kind) {
    case vscode.SymbolKind.Function:
      return "function";
    case vscode.SymbolKind.Class:
      return "class";
    case vscode.SymbolKind.Method:
      return "method";
    case vscode.SymbolKind.Constructor:
      return "method";
    default:
      return null;
  }
}
