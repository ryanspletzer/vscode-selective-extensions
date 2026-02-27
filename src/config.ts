import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import type { Logger } from "./logger";

export type CascadeSource = "user" | "workspace" | "selective-extensions.json";

const EXTENSION_ID_PATTERN = /^[\w-]+\.[\w.-]+$/;

export function isValidExtensionId(id: string): boolean {
  return EXTENSION_ID_PATTERN.test(id);
}

export interface RawLayer {
  source: CascadeSource;
  folder?: string;
  enabled?: boolean;
  enabledExtensions?: string[];
  autoApply?: boolean;
  includeBuiltins?: boolean;
}

export interface ResolvedConfig {
  enabled: boolean;
  enabledExtensions: string[];
  autoApply: boolean;
  includeBuiltins: boolean;
}

export interface ExtensionProvenance {
  id: string;
  sources: CascadeSource[];
}

export interface ConfigWithProvenance {
  config: ResolvedConfig;
  provenance: ExtensionProvenance[];
}

const NAMESPACE = "selectiveExtensions";

function readSettingsLayer(
  scope: vscode.ConfigurationScope | undefined,
  source: CascadeSource,
): RawLayer {
  const cfg = vscode.workspace.getConfiguration(NAMESPACE, scope);
  const inspect = {
    enabled: cfg.inspect<boolean>("enabled"),
    enabledExtensions: cfg.inspect<string[]>("enabledExtensions"),
    autoApply: cfg.inspect<boolean>("autoApply"),
    includeBuiltins: cfg.inspect<boolean>("includeBuiltins"),
  };

  const layer: RawLayer = { source };

  if (source === "user") {
    if (inspect.enabled?.globalValue !== undefined) {
      layer.enabled = inspect.enabled.globalValue;
    }
    if (inspect.enabledExtensions?.globalValue !== undefined) {
      layer.enabledExtensions = inspect.enabledExtensions.globalValue;
    }
    if (inspect.autoApply?.globalValue !== undefined) {
      layer.autoApply = inspect.autoApply.globalValue;
    }
    if (inspect.includeBuiltins?.globalValue !== undefined) {
      layer.includeBuiltins = inspect.includeBuiltins.globalValue;
    }
  } else {
    if (inspect.enabled?.workspaceValue !== undefined) {
      layer.enabled = inspect.enabled.workspaceValue;
    }
    if (inspect.enabledExtensions?.workspaceValue !== undefined) {
      layer.enabledExtensions = inspect.enabledExtensions.workspaceValue;
    }
    if (inspect.autoApply?.workspaceValue !== undefined) {
      layer.autoApply = inspect.autoApply.workspaceValue;
    }
    if (inspect.includeBuiltins?.workspaceValue !== undefined) {
      layer.includeBuiltins = inspect.includeBuiltins.workspaceValue;
    }
  }

  return layer;
}

function validateParsedConfig(
  parsed: Record<string, unknown>,
  logger?: Logger,
): DedicatedFileContent {
  const result: DedicatedFileContent = {};

  if (typeof parsed.enabled === "boolean") {
    result.enabled = parsed.enabled;
  }
  if (Array.isArray(parsed.enabledExtensions)) {
    result.enabledExtensions = parsed.enabledExtensions.filter(
      (e): e is string => {
        if (typeof e !== "string") return false;
        if (!isValidExtensionId(e)) {
          logger?.warn(`Ignoring invalid extension ID: ${e}`);
          return false;
        }
        return true;
      },
    );
  }
  if (typeof parsed.autoApply === "boolean") {
    result.autoApply = parsed.autoApply;
  }
  if (typeof parsed.includeBuiltins === "boolean") {
    result.includeBuiltins = parsed.includeBuiltins;
  }

  return result;
}

function readDedicatedFile(
  folderPath: string,
  logger: Logger,
): RawLayer | undefined {
  const filePath = path.join(folderPath, ".vscode", "selective-extensions.json");

  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const validated = validateParsedConfig(parsed, logger);

    const layer: RawLayer = {
      source: "selective-extensions.json",
      folder: folderPath,
      ...validated,
    };

    return layer;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown parse error";
    logger.warn(`Malformed JSON in ${filePath}: ${message}`);
    vscode.window
      .showWarningMessage(
        `Selective Extensions: Could not parse ${path.basename(filePath)}. Using other config levels.`,
        "Open File",
      )
      .then((action) => {
        if (action === "Open File") {
          vscode.workspace.openTextDocument(filePath).then((doc) => {
            vscode.window.showTextDocument(doc);
          });
        }
      });
    return undefined;
  }
}

export function readCascade(
  logger: Logger,
  workspaceFolders?: readonly vscode.WorkspaceFolder[],
): RawLayer[] {
  const layers: RawLayer[] = [];

  // Level 1: User settings
  layers.push(readSettingsLayer(undefined, "user"));

  if (!workspaceFolders || workspaceFolders.length === 0) {
    return layers;
  }

  // Level 2: Workspace settings (first folder scope for single-root,
  // or workspace-level for multi-root)
  layers.push(readSettingsLayer(workspaceFolders[0], "workspace"));

  // Level 3: Dedicated file from each workspace folder
  for (const folder of workspaceFolders) {
    const dedicatedLayer = readDedicatedFile(folder.uri.fsPath, logger);
    if (dedicatedLayer) {
      layers.push(dedicatedLayer);
    }
  }

  return layers;
}

export function mergeConfig(layers: RawLayer[]): ResolvedConfig {
  // Scalars: highest-specificity wins (last defined value)
  // Priority order: user < workspace < selective-extensions.json
  let enabled = true;
  let autoApply = true;
  let includeBuiltins = false;

  // Extensions: union across all levels
  const extensionSet = new Set<string>();

  for (const layer of layers) {
    if (layer.enabled !== undefined) {
      enabled = layer.enabled;
    }
    if (layer.autoApply !== undefined) {
      autoApply = layer.autoApply;
    }
    if (layer.includeBuiltins !== undefined) {
      includeBuiltins = layer.includeBuiltins;
    }
    if (layer.enabledExtensions) {
      for (const ext of layer.enabledExtensions) {
        extensionSet.add(ext.toLowerCase());
      }
    }
  }

  return {
    enabled,
    enabledExtensions: [...extensionSet],
    autoApply,
    includeBuiltins,
  };
}

export function resolveProvenance(layers: RawLayer[]): ExtensionProvenance[] {
  const provenanceMap = new Map<string, Set<CascadeSource>>();

  for (const layer of layers) {
    if (layer.enabledExtensions) {
      for (const ext of layer.enabledExtensions) {
        const id = ext.toLowerCase();
        if (!provenanceMap.has(id)) {
          provenanceMap.set(id, new Set());
        }
        provenanceMap.get(id)!.add(layer.source);
      }
    }
  }

  return [...provenanceMap.entries()].map(([id, sources]) => ({
    id,
    sources: [...sources],
  }));
}

export function readAndMerge(
  logger: Logger,
  workspaceFolders?: readonly vscode.WorkspaceFolder[],
): ConfigWithProvenance {
  const layers = readCascade(logger, workspaceFolders);
  return {
    config: mergeConfig(layers),
    provenance: resolveProvenance(layers),
  };
}

export function getDedicatedFilePath(
  folderPath: string,
): string {
  return path.join(folderPath, ".vscode", "selective-extensions.json");
}

export interface DedicatedFileContent {
  enabled?: boolean;
  enabledExtensions?: string[];
  autoApply?: boolean;
  includeBuiltins?: boolean;
}

export function readDedicatedFileContent(
  folderPath: string,
): DedicatedFileContent {
  const filePath = getDedicatedFilePath(folderPath);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return validateParsedConfig(parsed);
  } catch {
    return {};
  }
}

export function writeDedicatedFile(
  folderPath: string,
  content: DedicatedFileContent,
): void {
  const filePath = getDedicatedFilePath(folderPath);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + "\n", "utf-8");
}
