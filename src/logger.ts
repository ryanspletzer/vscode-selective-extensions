import * as vscode from "vscode";

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  dispose(): void;
}

export function createLogger(name: string): Logger {
  const channel = vscode.window.createOutputChannel(name);

  const timestamp = (): string => new Date().toISOString();

  return {
    info(message: string): void {
      channel.appendLine(`[${timestamp()}] [INFO] ${message}`);
    },
    warn(message: string): void {
      channel.appendLine(`[${timestamp()}] [WARN] ${message}`);
    },
    error(message: string): void {
      channel.appendLine(`[${timestamp()}] [ERROR] ${message}`);
    },
    dispose(): void {
      channel.dispose();
    },
  };
}
