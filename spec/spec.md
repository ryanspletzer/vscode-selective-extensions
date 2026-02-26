# Selective Extensions - Extension Specification

## Problem Statement

VS Code loads every installed extension in every workspace by default.
There is no built-in mechanism to declaratively specify
which extensions should be active for a given workspace.

The consequences compound in modern development workflows:

- **Resource waste**: each extension runs its own Node.js host process,
  consuming CPU and memory even when irrelevant to the workspace
- **Cognitive overhead**: command palette, status bar, and settings
  are cluttered with unrelated functionality
- **Agentic workflow impact**: developers running multiple VS Code windows
  alongside Claude Code terminals multiply the resource cost -
  every unnecessary extension runs N times across N windows
- **Scaling problem**: the existing community extension
  (`vscode-disable-extensions`) inverts the model by maintaining
  a deny list of extensions to disable,
  but this list grows with every new extension installed

## Goals

### v1

- Provide an **allow-list** model:
  declare which extensions should be active and disable everything else
- Store configuration in `settings.json`
  using VS Code's standard user/workspace cascade
- Merge user-level and workspace-level enable lists via union
- Allow individual users to opt out regardless of workspace settings
- Relaunch the current VS Code window with `--disable-extension` flags
  for extensions not on the allow list
- Provide command palette commands for managing the enable list
- Show a status bar indicator with the current enabled extension count
- Support importing recommendations from `.vscode/extensions.json`
- Handle multi-root workspaces by merging all folder-level lists

### Non-Goals (v1)

- Persistent enable/disable state across sessions without relaunch
  (VS Code has no public API for this)
- Profile management or creation
- SQLite (`state.vscdb`) manipulation
- Extension dependency resolution (user must include dependencies manually)
- Marketplace publishing in the initial release
- Sync enable lists across machines (deferred to VS Code Settings Sync)

## Configuration Schema

All settings live under the `selectiveExtensions` namespace.

### `selectiveExtensions.enabled`

| Property | Value         |
| -------- | ------------- |
| Type     | `boolean`     |
| Default  | `true`        |
| Scope    | `application` |

Controls whether the extension is active.
The extension reads this setting from the **user scope** via
`configuration.inspect().globalValue`.
A user can always opt out by setting this to `false` at the user level,
even if a workspace sets it to `true`.

When `false`, the extension takes no action on workspace open
and all commands are no-ops.

### `selectiveExtensions.enabledExtensions`

| Property | Value               |
| -------- | ------------------- |
| Type     | `array` of `string` |
| Default  | `[]`                |
| Scope    | `resource`          |

Array of extension identifiers (e.g., `"ms-python.python"`)
that should remain enabled.
The extension always implicitly includes itself in this list.

**Merge behavior**: the final enable list is the **union** of:

1. User-level `enabledExtensions` (personal base set)
2. Workspace-level `enabledExtensions` (project-specific additions)

An empty list at both levels means the extension takes no action
(there is nothing to enforce).

### `selectiveExtensions.autoApply`

| Property | Value      |
| -------- | ---------- |
| Type     | `boolean`  |
| Default  | `true`     |
| Scope    | `resource` |

When `true`, the extension automatically evaluates and triggers a relaunch
on workspace open if the current extension state does not match
the desired enable list.

When `false`, the user must manually run the
`Selective Extensions: Apply` command.

### `selectiveExtensions.includeBuiltins`

| Property | Value      |
| -------- | ---------- |
| Type     | `boolean`  |
| Default  | `false`    |
| Scope    | `resource` |

When `true`, built-in extensions (those shipped with VS Code)
are also subject to the enable list.
By default, built-in extensions are left untouched.

## Commands

All commands are prefixed with `selectiveExtensions.`.

### `selectiveExtensions.apply`

**Title**: Selective Extensions: Apply

Computes the disable list and relaunches the window.
This is the manual trigger equivalent of the automatic behavior.

### `selectiveExtensions.addExtension`

**Title**: Selective Extensions: Add Extension to Enable List

Shows a quick-pick of all installed extensions (excluding those already
on the enable list) and adds the selected extension(s) to the
workspace-level `enabledExtensions` setting.

### `selectiveExtensions.removeExtension`

**Title**: Selective Extensions: Remove Extension from Enable List

Shows a quick-pick of extensions currently on the enable list
and removes the selected extension(s) from the workspace-level
`enabledExtensions` setting.

### `selectiveExtensions.showList`

**Title**: Selective Extensions: Show Enable List

Displays the computed enable list (merged user + workspace)
in an information message or quick-pick, showing the source
(user/workspace) for each entry.

### `selectiveExtensions.importRecommendations`

**Title**: Selective Extensions: Import from Recommendations

Reads `.vscode/extensions.json` `recommendations` array
and adds all entries to the workspace-level `enabledExtensions` setting.
Existing entries are preserved (union merge).

## Status Bar

A status bar item displays the enabled extension count:

- **Format**: `$(extensions) N enabled` where N is the count
  of extensions on the merged enable list
- **Tooltip**: lists the extension IDs on the enable list
- **Click action**: opens the command palette filtered to
  Selective Extensions commands
- **Visibility**: shown only when `selectiveExtensions.enabled` is `true`
  and the enable list is non-empty

## Activation and Relaunch Flow

### Sequence

```text
1. VS Code opens workspace
2. Extension activates (activation event: onStartupFinished)
3. Check selectiveExtensions.enabled via inspect().globalValue
   - If false at user level → stop (user opted out)
4. Read enabledExtensions from user + workspace scopes
   - Compute merged enable list (union)
   - If empty → stop (nothing to enforce)
5. Check loop prevention flag
   - If flag is set → clear flag, stop (already relaunched)
6. Get all installed extensions via vscode.extensions.all
   - Filter to non-builtin (unless includeBuiltins is true)
   - Compute: disableList = installedExtensions - enableList
   - If disableList is empty → stop (all extensions are wanted)
7. Check autoApply setting
   - If false → stop (user will trigger manually)
8. Set loop prevention flag
9. Show notification: "Selective Extensions will restart VS Code
   to apply your extension configuration."
   - Buttons: [Apply Now] [Skip]
   - Apply Now → proceed to step 10
   - Skip → clear loop prevention flag, stop
10. Build CLI command:
    code --reuse-window <workspace-path> --disable-extension <id1>
    --disable-extension <id2> ...
11. Execute command via child_process
12. Current window closes, new window opens with restricted extensions
13. Extension activates again → step 5 catches the flag → stops
```

### Notification UX

On first automatic trigger, the extension shows an information message
with `[Apply Now]` and `[Skip]` buttons.
This gives the user visibility into what is happening
and an escape hatch to skip the relaunch.

The relaunch reuses the current window (`--reuse-window`)
so the user doesn't end up with extra windows.

## Loop Prevention

The extension must prevent an infinite relaunch cycle
(activate → detect mismatch → relaunch → activate → detect mismatch → ...).

### Mechanism

Set a flag before triggering the relaunch.
On next activation, check for the flag and skip the relaunch if present.

**Primary approach**: pass an environment variable
(e.g., `SELECTIVE_EXTENSIONS_APPLIED=1`) to the child process.
The extension reads `process.env.SELECTIVE_EXTENSIONS_APPLIED` on activation.

**Fallback approach**: use `context.workspaceState` to store
a timestamp of the last relaunch.
If the timestamp is within a short window (e.g., 30 seconds), skip.

The environment variable approach is preferred because it is
scoped to the exact child process and does not persist across
unrelated window opens.

## Multi-Root Workspaces

In a multi-root workspace, each folder may have its own
`.vscode/settings.json` with a different `enabledExtensions` list.

**Behavior**: the extension computes a **single merged list**
as the union of all folder-level lists plus the user-level list.

This means opening a multi-root workspace with folders A and B,
where A enables `[ext1, ext2]` and B enables `[ext2, ext3]`,
results in a final enable list of `[ext1, ext2, ext3]`.

This is the most permissive approach -
no extension requested by any folder is disabled.

## Edge Cases

### Extension Dependencies

If extension A depends on extension B and the user only adds A
to the enable list, B will be disabled and A may malfunction.

**v1 approach**: the user is responsible for including dependencies.
The spec does not require automatic dependency resolution.

**Future**: inspect `extensionDependencies` in each enabled extension's
`package.json` and automatically include transitive dependencies.

### New Extension Installs

When a user installs a new extension, it is enabled by default
in the current session.
On the next workspace open, the extension will not be on the enable list
and will be disabled by the relaunch.

The user must add it to the enable list to keep it active.

### Remote Development

When connected to a remote host (SSH, WSL, Dev Containers),
the extension runs in the remote extension host.
The relaunch mechanism (`code --reuse-window`) may not behave
identically in remote contexts.

**v1 approach**: detect remote sessions and skip automatic relaunch.
Provide a notification suggesting manual configuration.

### Empty Enable List

If the merged enable list is empty (no extensions configured anywhere),
the extension takes no action.
This prevents accidentally disabling all extensions.

### Extension Updates

When VS Code updates an extension, the extension ID remains the same.
The enable list does not need updating.

## Future Considerations

These are explicitly out of scope for v1 but inform architectural decisions.

### SQLite Persistence

VS Code stores extension enabled/disabled state in `state.vscdb`.
A future version could write directly to this database
to make changes persistent across sessions without relaunch.
Risks: database locking, undocumented schema, version-dependent behavior.

### Profile API

VS Code may eventually expose a programmatic profile management API
(see [microsoft/vscode#211890](https://github.com/microsoft/vscode/issues/211890)).
If this lands, the extension could create/switch profiles
with the correct extension set instead of using CLI flags.

### Extension Dependency Resolution

Automatically include transitive dependencies of enabled extensions
by reading `extensionDependencies` and `extensionPack` fields
from installed extension manifests.

### Workspace Trust Integration

Integrate with VS Code's Workspace Trust feature
to restrict extension activation in untrusted workspaces.

## Tech Stack

| Component               | Technology                            |
| ----------------------- | ------------------------------------- |
| Language                | TypeScript (strict mode)              |
| Bundler                 | esbuild                               |
| Test framework          | Mocha                                 |
| Minimum VS Code version | TBD (target current stable minus one) |
| License                 | MIT                                   |
| Publisher               | Personal (Ryan Spletzer)              |
