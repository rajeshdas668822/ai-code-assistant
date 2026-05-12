/**
 * File context extraction — current file path, content, selection, language.
 */
import * as vscode from "vscode";

export interface FileContextData {
  file_path: string;
  file_content: string;
  selection?: { start: number; end: number };
  selected_text?: string;
  language: string;
}

/**
 * Extract context from the active editor.
 * Returns undefined if no editor is open.
 */
export function getActiveFileContext(): FileContextData | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }

  const document = editor.document;
  const selection = editor.selection;

  const context: FileContextData = {
    file_path: document.uri.fsPath,
    file_content: document.getText(),
    language: document.languageId,
  };

  if (!selection.isEmpty) {
    context.selection = {
      start: document.offsetAt(selection.start),
      end: document.offsetAt(selection.end),
    };
    context.selected_text = document.getText(selection);
  }

  return context;
}

/**
 * Extract context for a specific selection range.
 */
export function getFileContextForRange(
  document: vscode.TextDocument,
  range: vscode.Range
): FileContextData {
  return {
    file_path: document.uri.fsPath,
    file_content: document.getText(),
    selection: {
      start: document.offsetAt(range.start),
      end: document.offsetAt(range.end),
    },
    selected_text: document.getText(range),
    language: document.languageId,
  };
}
