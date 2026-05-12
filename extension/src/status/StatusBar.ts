/**
 * Status bar items — model connection status, completion toggle, active agent.
 */
import * as vscode from "vscode";
import { Settings } from "../config/Settings";

export class StatusBar {
  private connectionItem: vscode.StatusBarItem;
  private completionItem: vscode.StatusBarItem;
  private agentItem: vscode.StatusBarItem;
  private settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;

    // Connection status (leftmost)
    this.connectionItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.connectionItem.command = "agent.checkHealth";

    // Completion toggle
    this.completionItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      99
    );
    this.completionItem.command = "agent.toggleCompletion";

    // Active agent indicator
    this.agentItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      98
    );
  }

  /** Show all status bar items */
  show(): void {
    this.updateConnectionStatus(false);
    this.updateCompletionToggle();
    this.hideAgent();

    this.connectionItem.show();
    this.completionItem.show();
  }

  /** Dispose all status bar items */
  dispose(): void {
    this.connectionItem.dispose();
    this.completionItem.dispose();
    this.agentItem.dispose();
  }

  /** Update connection status indicator */
  updateConnectionStatus(connected: boolean): void {
    if (connected) {
      this.connectionItem.text = "$(check) Agent: Connected";
      this.connectionItem.tooltip = `Connected to ${this.settings.backendUrl}`;
      this.connectionItem.backgroundColor = undefined;
    } else {
      this.connectionItem.text = "$(error) Agent: Disconnected";
      this.connectionItem.tooltip = `Cannot reach ${this.settings.backendUrl}. Click to retry.`;
      this.connectionItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.errorBackground"
      );
    }
  }

  /** Update the completion toggle display */
  updateCompletionToggle(): void {
    const enabled = this.settings.completionEnabled;
    if (enabled) {
      this.completionItem.text = "$(sparkle) Completions: On";
      this.completionItem.tooltip = "Click to disable inline completions";
    } else {
      this.completionItem.text = "$(circle-slash) Completions: Off";
      this.completionItem.tooltip = "Click to enable inline completions";
    }
  }

  /** Show the active agent name */
  showAgent(agentName: string): void {
    this.agentItem.text = `$(loading~spin) ${agentName}`;
    this.agentItem.tooltip = `Agent "${agentName}" is working...`;
    this.agentItem.show();
  }

  /** Hide the agent indicator */
  hideAgent(): void {
    this.agentItem.hide();
  }
}
