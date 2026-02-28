import * as vscode from "vscode";
import * as path from "path";
import type { Logger } from "./logger";
import type { StatusBar } from "./statusBar";
import {
  readAndMerge,
  readDedicatedFileContent,
  writeDedicatedFile,
  isValidExtensionId,
  type CascadeSource,
} from "./config";
import { triggerRelaunch, getLastProvenance, getImplicitExtensions, type ImplicitExtension } from "./extension";

function getExtraImplicitExtensions(configuredExtensions: string[]): ImplicitExtension[] {
  const configuredSet = new Set(configuredExtensions.map((e) => e.toLowerCase()));
  return getImplicitExtensions().filter((e) => !configuredSet.has(e.id.toLowerCase()));
}

function getWorkspaceFolderPath(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return folders[0].uri.fsPath;
  }
  return undefined;
}

async function promptRelaunch(
  disableList: string[],
  implicitExts: ImplicitExtension[],
  logger: Logger,
): Promise<void> {
  if (disableList.length === 0) {
    return;
  }

  const action = await vscode.window.showInformationMessage(
    "Configuration updated. Relaunch now to apply?",
    "Relaunch",
    "Later",
  );

  if (action === "Relaunch") {
    await triggerRelaunch(disableList, implicitExts, logger);
  }
}

function computeCurrentDisableList(
  enabledExtensions: string[],
  includeBuiltins: boolean,
): string[] {
  const enableSet = new Set(enabledExtensions.map((id) => id.toLowerCase()));
  const disableList: string[] = [];

  for (const ext of vscode.extensions.all) {
    const id = ext.id.toLowerCase();
    if (!includeBuiltins && ext.packageJSON?.isBuiltin) {
      continue;
    }
    if (!enableSet.has(id)) {
      disableList.push(ext.id);
    }
  }

  return disableList;
}

function sourceLabel(source: CascadeSource): string {
  switch (source) {
    case "user":
      return "user settings";
    case "workspace":
      return "workspace settings";
    case "selective-extensions.json":
      return "selective-extensions.json";
  }
}

export function registerCommands(
  context: vscode.ExtensionContext,
  logger: Logger,
  statusBar: StatusBar,
): void {
  // Apply command
  context.subscriptions.push(
    vscode.commands.registerCommand("selectiveExtensions.apply", async () => {
      logger.info("Apply command triggered");
      const { config } = readAndMerge(logger, vscode.workspace.workspaceFolders);

      if (!config.enabled) {
        vscode.window.showInformationMessage(
          "Selective Extensions is disabled.",
        );
        return;
      }

      if (config.enabledExtensions.length === 0) {
        vscode.window.showInformationMessage(
          "No extensions on the enable list. Add extensions first.",
        );
        return;
      }

      const disableList = computeCurrentDisableList(
        config.enabledExtensions,
        config.includeBuiltins,
      );

      if (disableList.length === 0) {
        vscode.window.showInformationMessage(
          "All extensions match the enable list. No relaunch needed.",
        );
        return;
      }

      const extraImplicit = getExtraImplicitExtensions(config.enabledExtensions);
      await triggerRelaunch(disableList, extraImplicit, logger);
    }),
  );

  // Add Extension command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "selectiveExtensions.addExtension",
      async () => {
        logger.info("Add Extension command triggered");
        const { config } = readAndMerge(
          logger,
          vscode.workspace.workspaceFolders,
        );
        const enableSet = new Set(
          config.enabledExtensions.map((id) => id.toLowerCase()),
        );

        // Build quick-pick items from installed extensions not on the list
        const items: vscode.QuickPickItem[] = [];
        for (const ext of vscode.extensions.all) {
          if (ext.packageJSON?.isBuiltin) continue;
          if (enableSet.has(ext.id.toLowerCase())) continue;

          items.push({
            label: ext.packageJSON?.displayName ?? ext.id,
            description: ext.id,
          });
        }

        items.sort((a, b) => a.label.localeCompare(b.label));

        if (items.length === 0) {
          vscode.window.showInformationMessage(
            "All installed extensions are already on the enable list.",
          );
          return;
        }

        const selected = await vscode.window.showQuickPick(items, {
          canPickMany: true,
          placeHolder: "Select extensions to add to the enable list",
        });

        if (!selected || selected.length === 0) return;

        const folderPath = getWorkspaceFolderPath();
        if (!folderPath) {
          vscode.window.showWarningMessage(
            "No workspace folder open. Cannot write configuration.",
          );
          return;
        }

        const content = readDedicatedFileContent(folderPath);
        const existing = new Set(
          (content.enabledExtensions ?? []).map((e) => e.toLowerCase()),
        );
        const toAdd = selected
          .map((item) => item.description!)
          .filter((id) => !existing.has(id.toLowerCase()));

        content.enabledExtensions = [
          ...(content.enabledExtensions ?? []),
          ...toAdd,
        ];
        writeDedicatedFile(folderPath, content);
        logger.info(`Added ${toAdd.length} extensions to enable list`);

        // Refresh status bar
        const updated = readAndMerge(
          logger,
          vscode.workspace.workspaceFolders,
        );
        const disableList = computeCurrentDisableList(
          updated.config.enabledExtensions,
          updated.config.includeBuiltins,
        );
        statusBar.update(
          updated.config.enabledExtensions.length,
          disableList.length === 0,
        );

        const extraImplicit = getExtraImplicitExtensions(updated.config.enabledExtensions);
        await promptRelaunch(disableList, extraImplicit, logger);
      },
    ),
  );

  // Remove Extension command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "selectiveExtensions.removeExtension",
      async () => {
        logger.info("Remove Extension command triggered");
        const folderPath = getWorkspaceFolderPath();
        const { config } = readAndMerge(
          logger,
          vscode.workspace.workspaceFolders,
        );
        const provenance = getLastProvenance();

        // Build quick-pick: level-3 entries are removable, others are read-only
        const dedicatedContent = folderPath
          ? readDedicatedFileContent(folderPath)
          : { enabledExtensions: [] };
        const dedicatedSet = new Set(
          (dedicatedContent.enabledExtensions ?? []).map((e) =>
            e.toLowerCase(),
          ),
        );

        const items: vscode.QuickPickItem[] = [];

        for (const ext of config.enabledExtensions) {
          const prov = provenance.find((p) => p.id === ext);
          const sources = prov?.sources ?? [];
          const isRemovable = dedicatedSet.has(ext.toLowerCase());

          const displayName =
            vscode.extensions.getExtension(ext)?.packageJSON?.displayName ??
            ext;

          if (isRemovable) {
            items.push({
              label: displayName,
              description: ext,
              detail: "removable",
            });
          } else {
            const sourceLabels = sources.map(sourceLabel).join(", ");
            items.push({
              label: displayName,
              description: ext,
              detail: `from ${sourceLabels} (edit manually)`,
              picked: false,
            });
          }
        }

        items.sort((a, b) => {
          // Removable items first
          if (a.detail === "removable" && b.detail !== "removable") return -1;
          if (a.detail !== "removable" && b.detail === "removable") return 1;
          return a.label.localeCompare(b.label);
        });

        if (items.length === 0) {
          vscode.window.showInformationMessage(
            "The enable list is empty.",
          );
          return;
        }

        const selected = await vscode.window.showQuickPick(items, {
          canPickMany: true,
          placeHolder:
            "Select extensions to remove (only items from selective-extensions.json can be removed)",
        });

        if (!selected || selected.length === 0) return;

        const removable = selected.filter((s) => s.detail === "removable");
        const nonRemovable = selected.filter((s) => s.detail !== "removable");

        if (nonRemovable.length > 0) {
          vscode.window.showWarningMessage(
            `${nonRemovable.length} extension(s) are from other config levels and must be edited manually.`,
          );
        }

        if (removable.length > 0 && folderPath) {
          const content = readDedicatedFileContent(folderPath);
          const removeSet = new Set(
            removable.map((item) => item.description!.toLowerCase()),
          );
          content.enabledExtensions = (content.enabledExtensions ?? []).filter(
            (e) => !removeSet.has(e.toLowerCase()),
          );
          writeDedicatedFile(folderPath, content);
          logger.info(
            `Removed ${removable.length} extensions from enable list`,
          );

          // Refresh status bar
          const updated = readAndMerge(
            logger,
            vscode.workspace.workspaceFolders,
          );
          const disableList = computeCurrentDisableList(
            updated.config.enabledExtensions,
            updated.config.includeBuiltins,
          );
          statusBar.update(
            updated.config.enabledExtensions.length,
            disableList.length === 0,
          );

          const extraImplicit = getExtraImplicitExtensions(updated.config.enabledExtensions);
          await promptRelaunch(disableList, extraImplicit, logger);
        }
      },
    ),
  );

  // Show List command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "selectiveExtensions.showList",
      async () => {
        logger.info("Show List command triggered");
        const { config } = readAndMerge(
          logger,
          vscode.workspace.workspaceFolders,
        );
        const provenance = getLastProvenance();

        if (config.enabledExtensions.length === 0) {
          vscode.window.showInformationMessage(
            "The enable list is empty. Add extensions to get started.",
          );
          return;
        }

        const items: vscode.QuickPickItem[] = config.enabledExtensions.map(
          (ext) => {
            const prov = provenance.find((p) => p.id === ext);
            const sources = (prov?.sources ?? []).map(sourceLabel).join(", ");
            const displayName =
              vscode.extensions.getExtension(ext)?.packageJSON?.displayName ??
              ext;

            return {
              label: displayName,
              description: ext,
              detail: sources,
            };
          },
        );

        items.sort((a, b) => a.label.localeCompare(b.label));

        await vscode.window.showQuickPick(items, {
          placeHolder: `${config.enabledExtensions.length} extensions on the enable list`,
        });
      },
    ),
  );

  // Import Recommendations command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "selectiveExtensions.importRecommendations",
      async () => {
        logger.info("Import Recommendations command triggered");
        const folderPath = getWorkspaceFolderPath();
        if (!folderPath) {
          vscode.window.showWarningMessage(
            "No workspace folder open. Cannot import recommendations.",
          );
          return;
        }

        const extensionsJsonPath = path.join(
          folderPath,
          ".vscode",
          "extensions.json",
        );

        let recommendations: string[];
        try {
          const content = await vscode.workspace.fs.readFile(
            vscode.Uri.file(extensionsJsonPath),
          );
          const parsed = JSON.parse(Buffer.from(content).toString("utf-8")) as {
            recommendations?: string[];
          };
          recommendations = (parsed.recommendations ?? []).filter(
            (r): r is string =>
              typeof r === "string" && isValidExtensionId(r),
          );
        } catch {
          vscode.window.showInformationMessage(
            "No .vscode/extensions.json found or it contains no recommendations.",
          );
          return;
        }

        if (recommendations.length === 0) {
          vscode.window.showInformationMessage(
            "The recommendations list in .vscode/extensions.json is empty.",
          );
          return;
        }

        const dedicatedContent = readDedicatedFileContent(folderPath);
        const existing = new Set(
          (dedicatedContent.enabledExtensions ?? []).map((e) =>
            e.toLowerCase(),
          ),
        );
        const toAdd = recommendations.filter(
          (r) => !existing.has(r.toLowerCase()),
        );

        dedicatedContent.enabledExtensions = [
          ...(dedicatedContent.enabledExtensions ?? []),
          ...toAdd,
        ];
        writeDedicatedFile(folderPath, dedicatedContent);

        logger.info(
          `Imported ${toAdd.length} recommendations (${recommendations.length} total, ${recommendations.length - toAdd.length} already present)`,
        );
        vscode.window.showInformationMessage(
          `Imported ${toAdd.length} extension(s) from recommendations.`,
        );

        // Refresh status bar
        const updated = readAndMerge(
          logger,
          vscode.workspace.workspaceFolders,
        );
        const disableList = computeCurrentDisableList(
          updated.config.enabledExtensions,
          updated.config.includeBuiltins,
        );
        statusBar.update(
          updated.config.enabledExtensions.length,
          disableList.length === 0,
        );
      },
    ),
  );
}
