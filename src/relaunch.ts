import * as vscode from "vscode";
import * as cp from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Logger } from "./logger";
import { clearLoopGuard } from "./loopGuard";

const CLI_VARIANTS: Record<string, string> = {
  "Visual Studio Code": "code",
  "Visual Studio Code - Insiders": "code-insiders",
  "VSCodium": "codium",
};

const MACOS_APP_NAMES: Record<string, string> = {
  "Visual Studio Code": "Visual Studio Code",
  "Visual Studio Code - Insiders": "Visual Studio Code - Insiders",
  "VSCodium": "VSCodium",
};

const PLATFORM_FALLBACKS: Record<string, Record<string, string[]>> = {
  darwin: {
    code: ["/usr/local/bin/code", "/opt/homebrew/bin/code"],
    "code-insiders": ["/usr/local/bin/code-insiders", "/opt/homebrew/bin/code-insiders"],
    codium: ["/usr/local/bin/codium", "/opt/homebrew/bin/codium"],
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
  const args = ["--new-window", workspacePath];
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
  const disableCount = args.filter((a) => a === "--disable-extension").length;

  if (process.platform === "darwin") {
    executeMacOSRelaunch(args, disableCount, logger);
  } else {
    executeCliRelaunch(cliPath, args, disableCount, logger);
  }
}

function executeMacOSRelaunch(
  args: string[],
  disableCount: number,
  logger: Logger,
): void {
  // On macOS, the `code` CLI and `open -n` both route through the running
  // VS Code instance, which ignores --disable-extension flags. The only
  // way to honor them is to launch from outside VS Code's process tree
  // after this window closes.
  //
  // Strategy: write a temp shell script that waits for this window to close,
  // then launches VS Code fresh. Spawn it fully detached via launchctl so
  // it survives the VS Code process exiting.
  const appName = MACOS_APP_NAMES[vscode.env.appName] ?? "Visual Studio Code";

  // Shell-escape each arg
  const escapedArgs = args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ");

  const scriptPath = path.join(os.tmpdir(), `selective-extensions-relaunch-${process.pid}.sh`);
  const script = `#!/bin/bash
# Wait for the current VS Code window to close
sleep 2
# Launch a fresh VS Code instance
open -n -a '${appName.replace(/'/g, "'\\''")}' --args ${escapedArgs}
# Clean up this script
rm -f '${scriptPath.replace(/'/g, "'\\''")}'
`;

  try {
    fs.writeFileSync(scriptPath, script, { mode: 0o755 });
  } catch (err) {
    clearLoopGuard();
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to write relaunch script: ${message}`);
    vscode.window.showErrorMessage(
      `Selective Extensions: Relaunch failed. Could not write temp script.`,
    );
    return;
  }

  logger.info(
    `Wrote relaunch script to ${scriptPath} (disabling ${disableCount} extensions)`,
  );

  // Spawn with a minimal environment so the script runs outside VS Code's
  // context. PATH must include /usr/bin for `open` and `rm`.
  const child = cp.spawn("/bin/bash", [scriptPath], {
    detached: true,
    stdio: "ignore",
    env: {
      PATH: "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin",
      HOME: os.homedir(),
    },
  });
  child.unref();

  logger.info("Relaunch script spawned; closing current window");

  // Close the current window so VS Code can quit (if this is the last window)
  // and the detached script can launch a fresh instance.
  setTimeout(() => {
    vscode.commands.executeCommand("workbench.action.closeWindow");
  }, 500);
}

function executeCliRelaunch(
  cliPath: string,
  args: string[],
  disableCount: number,
  logger: Logger,
): void {
  logger.info(
    `Executing: ${cliPath} --new-window <workspace> (disabling ${disableCount} extensions)`,
  );

  // Strip VS Code environment variables so the CLI launches a fresh
  // instance instead of routing through the current extension host.
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("VSCODE_") || key === "ELECTRON_RUN_AS_NODE") {
      delete env[key];
    }
  }

  const child = cp.spawn(cliPath, args, {
    shell: true,
    env,
  });

  let stderr = "";
  child.stderr?.on("data", (data: Buffer) => {
    stderr += data.toString();
  });

  child.on("error", (err) => {
    clearLoopGuard();
    logger.error(`Spawn error: ${err.message}`);
    vscode.window.showErrorMessage(
      `Selective Extensions: Relaunch failed. ${err.message}`,
    );
  });

  child.on("close", (code) => {
    if (code !== 0) {
      clearLoopGuard();
      logger.error(`CLI exited with code ${code}: ${stderr}`);
      vscode.window.showErrorMessage(
        `Selective Extensions: Relaunch failed (exit code ${code}). ${stderr}`,
      );
    } else {
      logger.info("New VS Code instance launched successfully");
      setTimeout(() => {
        vscode.commands.executeCommand("workbench.action.closeWindow");
      }, 2000);
    }
  });
}
