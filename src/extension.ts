import * as vscode from "vscode";
import { createLogger, type Logger } from "./logger";
import { isLoopGuardSet, setLoopGuard, clearLoopGuard } from "./loopGuard";
import { readAndMerge } from "./config";
import {
  detectCliVariant,
  resolveCliPath,
  buildArgs,
  resolveWorkspacePath,
  executeRelaunch,
} from "./relaunch";
import { registerCommands } from "./commands";
import { createStatusBar, type StatusBar } from "./statusBar";

let logger: Logger;
let statusBar: StatusBar;

export interface ImplicitExtension {
  id: string;
  label: string;
}

export function getImplicitExtensions(): ImplicitExtension[] {
  const implicit: ImplicitExtension[] = [];

  // Always include this extension
  implicit.push({ id: "ryanspletzer.selective-extensions", label: "Selective Extensions" });

  // Include active color theme extension
  const colorThemeName = vscode.workspace
    .getConfiguration("workbench")
    .get<string>("colorTheme");
  if (colorThemeName) {
    const themeExt = findExtensionForTheme(colorThemeName, "themes");
    if (themeExt) {
      implicit.push({ id: themeExt, label: `${colorThemeName} theme` });
    }
  }

  // Include active icon theme extension
  const iconThemeName = vscode.workspace
    .getConfiguration("workbench")
    .get<string>("iconTheme");
  if (iconThemeName) {
    const iconExt = findExtensionForTheme(iconThemeName, "iconThemes");
    if (iconExt) {
      implicit.push({ id: iconExt, label: `${iconThemeName} icon theme` });
    }
  }

  return implicit;
}

function findExtensionForTheme(
  themeName: string,
  contributeKey: "themes" | "iconThemes",
): string | undefined {
  for (const ext of vscode.extensions.all) {
    const contributes = ext.packageJSON?.contributes;
    if (!contributes) continue;

    const themes = contributes[contributeKey] as
      | Array<{ id?: string; label?: string }>
      | undefined;
    if (!themes) continue;

    for (const theme of themes) {
      if (theme.id === themeName || theme.label === themeName) {
        return ext.id.toLowerCase();
      }
    }
  }
  return undefined;
}

function computeDisableList(
  enableList: string[],
  includeBuiltins: boolean,
): string[] {
  const enableSet = new Set(enableList.map((id) => id.toLowerCase()));
  const disableList: string[] = [];

  for (const ext of vscode.extensions.all) {
    const id = ext.id.toLowerCase();

    // Skip builtins unless includeBuiltins is set
    if (!includeBuiltins && ext.packageJSON?.isBuiltin) {
      continue;
    }

    if (!enableSet.has(id)) {
      disableList.push(ext.id);
    }
  }

  return disableList;
}

function isRemoteSession(): boolean {
  return !!vscode.env.remoteName;
}

async function runActivationFlow(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  // Step 2: Read config
  const { config, provenance } = readAndMerge(logger, workspaceFolders);

  // Step 3: Check enabled
  if (!config.enabled) {
    logger.info("Opted out: enabled is false");
    statusBar.hide();
    return;
  }

  // Step 4: Compute merged enable list + implicit includes
  const implicitExts = getImplicitExtensions();
  const implicitIds = implicitExts.map((e) => e.id.toLowerCase());
  const fullEnableList = [
    ...new Set([...config.enabledExtensions, ...implicitIds]),
  ];

  if (config.enabledExtensions.length === 0) {
    logger.info("No extensions configured in enable list; nothing to enforce");
    statusBar.hide();
    return;
  }

  // Step 5: Check loop guard
  if (isLoopGuardSet()) {
    clearLoopGuard();
    logger.info("Loop guard detected; skipping relaunch (already relaunched)");
    // Still show status bar in relaunched session
    const disableList = computeDisableList(fullEnableList, config.includeBuiltins);
    statusBar.update(config.enabledExtensions.length, disableList.length === 0);
    return;
  }

  // Step 6-7: Compute disable list
  const disableList = computeDisableList(fullEnableList, config.includeBuiltins);
  statusBar.update(config.enabledExtensions.length, disableList.length === 0);

  if (disableList.length === 0) {
    logger.info("All extensions are on the enable list; nothing to disable");
    return;
  }

  // Detect remote session
  if (isRemoteSession()) {
    logger.info("Remote session detected; skipping auto-relaunch");
    vscode.window.showInformationMessage(
      "Selective Extensions: Auto-relaunch is not supported in remote sessions. Use the Apply command manually if needed.",
    );
    return;
  }

  // Step 8: Check autoApply
  if (!config.autoApply) {
    logger.info("autoApply is false; waiting for manual Apply command");
    return;
  }

  // Steps 9-12: Relaunch
  // Only count implicit extensions that aren't already in the user's configured list
  const configuredSet = new Set(config.enabledExtensions.map((e) => e.toLowerCase()));
  const extraImplicit = implicitExts.filter((e) => !configuredSet.has(e.id.toLowerCase()));
  await triggerRelaunch(disableList, extraImplicit, logger);

  // Store provenance for commands to use
  // (workaround: attach to global state so commands can access it)
  _lastProvenance = provenance;
}

export async function triggerRelaunch(
  disableList: string[],
  implicitExts: ImplicitExtension[],
  log: Logger,
): Promise<void> {
  // Set loop guard before showing notification
  setLoopGuard();

  const nonBuiltinCount = vscode.extensions.all.filter(
    (ext) => !ext.packageJSON?.isBuiltin,
  ).length;
  const keepCount = nonBuiltinCount - disableList.length;
  const implicitSuffix =
    implicitExts.length > 0
      ? ` (plus ${implicitExts.length} implicit: ${implicitExts.map((e) => e.label).join(", ")})`
      : "";
  const configuredCount = keepCount - implicitExts.length;
  const action = await vscode.window.showInformationMessage(
    `Selective Extensions will disable ${disableList.length} extensions and keep ${configuredCount} enabled${implicitSuffix}.`,
    "Apply Now",
    "Skip",
  );

  if (action !== "Apply Now") {
    // Dismiss or Skip: clear flag and stop
    clearLoopGuard();
    log.info(`User selected ${action ?? "dismiss"}; relaunch cancelled`);
    return;
  }

  const variant = detectCliVariant();
  const cliPath = resolveCliPath(variant, log);
  if (!cliPath) {
    clearLoopGuard();
    log.error(`Could not find ${variant} CLI`);
    vscode.window.showErrorMessage(
      `Selective Extensions: Could not find the "${variant}" command. Please ensure VS Code CLI is on your PATH.`,
    );
    return;
  }

  const workspacePath = resolveWorkspacePath();
  if (!workspacePath) {
    clearLoopGuard();
    log.warn("No workspace path available for relaunch");
    return;
  }

  const args = buildArgs(workspacePath, disableList);
  executeRelaunch(cliPath, args, log);
}

// Shared state for commands to access current config
let _lastProvenance: import("./config").ExtensionProvenance[] = [];
export function getLastProvenance(): import("./config").ExtensionProvenance[] {
  return _lastProvenance;
}

export function activate(context: vscode.ExtensionContext): void {
  logger = createLogger("Selective Extensions");
  statusBar = createStatusBar();

  context.subscriptions.push({ dispose: () => logger.dispose() });
  context.subscriptions.push({ dispose: () => statusBar.dispose() });

  registerCommands(context, logger, statusBar);

  runActivationFlow().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Activation failed: ${message}`);
  });
}

export function deactivate(): void {
  // Disposables are handled via context.subscriptions
}
