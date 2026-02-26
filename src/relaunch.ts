import * as vscode from "vscode";
import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { Logger } from "./logger";
import { clearLoopGuard } from "./loopGuard";

const CLI_VARIANTS: Record<string, string> = {
  "Visual Studio Code": "code",
  "Visual Studio Code - Insiders": "code-insiders",
  "VSCodium": "codium",
};

const PLATFORM_FALLBACKS: Record<string, Record<string, string[]>> = {
  darwin: {
    code: ["/usr/local/bin/code"],
    "code-insiders": ["/usr/local/bin/code-insiders"],
    codium: ["/usr/local/bin/codium"],
  },
  win32: {
    code: [
      path.join(
        process.env["PROGRAMFILES"] ?? "C:\\Program Files",
        "Microsoft VS Code",
        "bin",
        "code.cmd",
      ),
    ],
    "code-insiders": [
      path.join(
        process.env["PROGRAMFILES"] ?? "C:\\Program Files",
        "Microsoft VS Code Insiders",
        "bin",
        "code-insiders.cmd",
      ),
    ],
    codium: [
      path.join(
        process.env["PROGRAMFILES"] ?? "C:\\Program Files",
        "VSCodium",
        "bin",
        "codium.cmd",
      ),
    ],
  },
  linux: {
    code: ["/usr/bin/code", "/usr/local/bin/code"],
    "code-insiders": ["/usr/bin/code-insiders", "/usr/local/bin/code-insiders"],
    codium: ["/usr/bin/codium", "/usr/local/bin/codium"],
  },
};

export function detectCliVariant(): string {
  const appName = vscode.env.appName;
  return CLI_VARIANTS[appName] ?? "code";
}

export function resolveCliPath(variant: string, logger: Logger): string | undefined {
  // Check if the variant is directly executable on PATH
  // by trying a known location or relying on the shell to resolve it
  const platformFallbacks =
    PLATFORM_FALLBACKS[process.platform]?.[variant] ?? [];

  for (const candidate of platformFallbacks) {
    if (fs.existsSync(candidate)) {
      logger.info(`CLI resolved via fallback: ${candidate}`);
      return candidate;
    }
  }

  // Fall back to the variant name itself (assumes it's on PATH)
  logger.info(`CLI resolved via PATH: ${variant}`);
  return variant;
}

export function buildArgs(
  workspacePath: string,
  disableIds: string[],
): string[] {
  const args = ["--reuse-window", workspacePath];
  for (const id of disableIds) {
    args.push("--disable-extension", id);
  }
  return args;
}

export function resolveWorkspacePath(): string | undefined {
  // Prefer .code-workspace file for multi-root workspaces
  const workspaceFile = vscode.workspace.workspaceFile;
  if (workspaceFile && workspaceFile.scheme === "file") {
    return workspaceFile.fsPath;
  }

  // Fall back to first workspace folder
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return folders[0].uri.fsPath;
  }

  return undefined;
}

export function executeRelaunch(
  cliPath: string,
  args: string[],
  logger: Logger,
): void {
  logger.info(`Executing: ${cliPath} ${args.join(" ")}`);

  cp.execFile(cliPath, args, (err, _stdout, stderr) => {
    if (err) {
      clearLoopGuard();
      const message = stderr || err.message;
      logger.error(`Relaunch failed: ${message}`);
      vscode.window.showErrorMessage(
        `Selective Extensions: Relaunch failed. ${message}`,
      );
    }
  });
}
