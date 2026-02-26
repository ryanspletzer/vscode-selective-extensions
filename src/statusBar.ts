import * as vscode from "vscode";

export interface StatusBar {
  update(enabledCount: number, isApplied: boolean): void;
  hide(): void;
  dispose(): void;
}

export function createStatusBar(): StatusBar {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    50,
  );
  item.command = "workbench.action.quickOpen";

  return {
    update(enabledCount: number, isApplied: boolean): void {
      if (enabledCount === 0) {
        item.hide();
        return;
      }

      if (isApplied) {
        item.text = `$(extensions) ${enabledCount} enabled`;
        item.backgroundColor = undefined;
        item.tooltip = "Selective Extensions: configuration applied";
      } else {
        item.text = `$(warning) ${enabledCount} enabled (relaunch needed)`;
        item.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.warningBackground",
        );
        item.tooltip =
          "Selective Extensions: extensions need to be reapplied";
      }

      // Filter command palette to Selective Extensions commands
      item.command = {
        command: "workbench.action.quickOpen",
        title: "Selective Extensions",
        arguments: [">Selective Extensions"],
      };

      item.show();
    },

    hide(): void {
      item.hide();
    },

    dispose(): void {
      item.dispose();
    },
  };
}
