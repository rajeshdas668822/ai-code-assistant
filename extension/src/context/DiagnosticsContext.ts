/**
 * Terminal output and diagnostics integration.
 * Reads VS Code Problems panel and terminal output for the Debugger agent.
 */
import * as vscode from "vscode";

export interface DiagnosticInfo {
  file_path: string;
  line: number;
  column: number;
  severity: "error" | "warning" | "info" | "hint";
  message: string;
  source?: string;
}

/**
 * Get all diagnostics (errors/warnings) from the VS Code Problems panel.
 * Optionally filter to a specific file.
 */
export function getDiagnostics(fileUri?: vscode.Uri): DiagnosticInfo[] {
  const results: DiagnosticInfo[] = [];

  if (fileUri) {
    const fileDiagnostics = vscode.languages.getDiagnostics(fileUri);
    for (const diag of fileDiagnostics) {
      results.push(toDiagnosticInfo(fileUri, diag));
    }
  } else {
    const allDiagnostics = vscode.languages.getDiagnostics();
    for (const [uri, diagnostics] of allDiagnostics) {
      for (const diag of diagnostics) {
        results.push(toDiagnosticInfo(uri, diag));
      }
    }
  }

  return results;
}

/**
 * Get only errors from the Problems panel.
 */
export function getErrors(fileUri?: vscode.Uri): DiagnosticInfo[] {
  return getDiagnostics(fileUri).filter((d) => d.severity === "error");
}

/**
 * Format diagnostics into a string suitable for sending to the agent.
 */
export function formatDiagnosticsForAgent(
  diagnostics: DiagnosticInfo[]
): string {
  if (diagnostics.length === 0) {
    return "No diagnostics found.";
  }

  const lines = diagnostics.map(
    (d) =>
      `[${d.severity.toUpperCase()}] ${d.file_path}:${d.line}:${d.column} - ${d.message}${d.source ? ` (${d.source})` : ""}`
  );

  return lines.join("\n");
}

function toDiagnosticInfo(
  uri: vscode.Uri,
  diag: vscode.Diagnostic
): DiagnosticInfo {
  return {
    file_path: uri.fsPath,
    line: diag.range.start.line + 1,
    column: diag.range.start.character + 1,
    severity: mapSeverity(diag.severity),
    message: diag.message,
    source: diag.source,
  };
}

function mapSeverity(
  severity: vscode.DiagnosticSeverity
): "error" | "warning" | "info" | "hint" {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return "error";
    case vscode.DiagnosticSeverity.Warning:
      return "warning";
    case vscode.DiagnosticSeverity.Information:
      return "info";
    case vscode.DiagnosticSeverity.Hint:
      return "hint";
  }
}

/**
 * Capture text from the active terminal's clipboard selection.
 * Note: VS Code API doesn't provide direct terminal buffer access,
 * so we use the clipboard-based approach via the terminal selection.
 */
export async function getTerminalSelection(): Promise<string | undefined> {
  const terminal = vscode.window.activeTerminal;
  if (!terminal) {
    return undefined;
  }

  // Copy terminal selection to clipboard and read it
  await vscode.commands.executeCommand(
    "workbench.action.terminal.copySelection"
  );
  const text = await vscode.env.clipboard.readText();
  return text || undefined;
}
