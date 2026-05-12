/**
 * Extension settings management — reads from VS Code configuration.
 */
import * as vscode from "vscode";

const SECTION = "multiAgentAssistant";

export interface ModelAssignment {
  planner: string;
  coder: string;
  reviewer: string;
  debugger: string;
  completion: string;
}

export type ModelPreset = "fast" | "balanced" | "quality";

const PRESET_MODELS: Record<ModelPreset, ModelAssignment> = {
  fast: {
    planner: "qwen2.5-coder:7b",
    coder: "qwen2.5-coder:7b",
    reviewer: "qwen2.5-coder:7b",
    debugger: "qwen2.5-coder:7b",
    completion: "qwen2.5-coder:7b",
  },
  balanced: {
    planner: "qwen2.5-coder:7b",
    coder: "qwen2.5-coder:7b",
    reviewer: "qwen2.5-coder:7b",
    debugger: "qwen2.5-coder:7b",
    completion: "qwen2.5-coder:7b",
  },
  quality: {
    planner: "qwen2.5-coder:32b",
    coder: "qwen2.5-coder:32b",
    reviewer: "qwen2.5-coder:32b",
    debugger: "qwen2.5-coder:32b",
    completion: "qwen2.5-coder:7b",
  },
};

export class Settings {
  private get config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(SECTION);
  }

  /** Backend server URL */
  get backendUrl(): string {
    return this.config.get<string>("backendUrl", "http://127.0.0.1:8000");
  }

  /** Whether inline completions are enabled */
  get completionEnabled(): boolean {
    return this.config.get<boolean>("completionEnabled", true);
  }

  /** Debounce delay in ms before triggering completions */
  get completionDelay(): number {
    return this.config.get<number>("completionDelay", 300);
  }

  /** Max tokens for completion responses */
  get completionMaxTokens(): number {
    return this.config.get<number>("completionMaxTokens", 128);
  }

  /** Active model preset */
  get modelPreset(): ModelPreset {
    return this.config.get<ModelPreset>("modelPreset", "balanced");
  }

  /** Get model assignments based on the active preset */
  get modelAssignments(): ModelAssignment {
    return PRESET_MODELS[this.modelPreset];
  }

  /** Toggle completion on/off and persist the setting */
  async toggleCompletion(): Promise<boolean> {
    const newValue = !this.completionEnabled;
    await this.config.update(
      "completionEnabled",
      newValue,
      vscode.ConfigurationTarget.Global
    );
    return newValue;
  }

  /** Listen for settings changes */
  onDidChange(callback: () => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(SECTION)) {
        callback();
      }
    });
  }
}
