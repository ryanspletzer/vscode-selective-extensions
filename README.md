# Selective Extensions

<!-- Uncomment these badges after publishing to the VS Code Marketplace:
[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/ryanspletzer.selective-extensions)](https://marketplace.visualstudio.com/items?itemName=ryanspletzer.selective-extensions)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/ryanspletzer.selective-extensions)](https://marketplace.visualstudio.com/items?itemName=ryanspletzer.selective-extensions)
[![Visual Studio Marketplace Rating](https://img.shields.io/visual-studio-marketplace/r/ryanspletzer.selective-extensions)](https://marketplace.visualstudio.com/items?itemName=ryanspletzer.selective-extensions)
-->

Declare which VS Code extensions should be active per workspace —
everything else gets disabled via CLI relaunch.

## Why

VS Code loads every installed extension in every workspace.
There is no built-in way to say "this workspace only needs these five extensions."
The result is wasted resources, a cluttered command palette,
and unnecessary overhead when running multiple windows alongside agentic workflows.

Selective Extensions flips the model:
you declare an **allow list** of extensions to keep,
and the extension disables everything else by relaunching VS Code
with `--disable-extension` flags.

## Features

- **Allow-list model** — declare what stays, disable the rest
- **Three-level configuration cascade** — user, workspace, and per-project file
- **Union merge** — enable lists from all levels combine automatically
- **Quick-pick commands** — add, remove, and browse extensions from the command palette
- **Import recommendations** — seed your enable list from `.vscode/extensions.json`
- **Status bar indicator** — see enabled count and mismatch warnings at a glance
- **Implicit includes** — the extension itself, your active color theme,
  and active icon theme are always kept
- **Multi-root support** — uses workspace file path when available
- **Loop prevention** — env var guard prevents infinite relaunch cycles
- **Remote session detection** — warns and skips relaunch in remote/SSH/WSL windows

<!-- Screenshots — capture and add these before publishing:
- Status bar indicator (normal and mismatch states)
- Command palette showing Selective Extensions commands
- Add Extension quick-pick multi-select
- Relaunch notification prompt

*Screenshots will be added before the first marketplace release.* -->

## Installation

### From the Marketplace

Search for **Selective Extensions** in the VS Code Extensions sidebar,
or install from the command line:

```bash
code --install-extension ryanspletzer.selective-extensions
```

### From `.vsix`

```bash
code --install-extension selective-extensions-0.0.1.vsix
```

### From Source

```bash
# Using Bun (preferred)
bun install
bun run package
code --install-extension selective-extensions-0.0.1.vsix

# Using npm
npm install
npm run package
code --install-extension selective-extensions-0.0.1.vsix
```

## Quick Start

1. Open a workspace in VS Code
2. Run **Selective Extensions: Add Extension to Enable List** from the command palette
3. Pick the extensions you need for this workspace
4. Accept the relaunch prompt

On next open, the extension auto-evaluates and offers to relaunch
with only your chosen extensions active.

## Configuration

Settings live in three levels.
Scalars (booleans) use highest-specificity-wins.
Arrays (extension lists) are merged via union across all levels.

| Priority | Source | Audience |
| -------- | ------ | -------- |
| 1 (low) | User `settings.json` | Personal global base |
| 2 | Workspace `.vscode/settings.json` | Team / shared |
| 3 (high) | `.vscode/selective-extensions.json` | Personal per-project |

### Settings in `settings.json`

Use the `selectiveExtensions.*` namespace:

```jsonc
{
  "selectiveExtensions.enabled": true,
  "selectiveExtensions.enabledExtensions": [
    "ms-python.python",
    "esbenp.prettier-vscode"
  ],
  "selectiveExtensions.autoApply": true,
  "selectiveExtensions.includeBuiltins": false
}
```

### Dedicated File (`.vscode/selective-extensions.json`)

Uses bare keys — no namespace:

```json
{
  "enabledExtensions": [
    "ms-python.python",
    "ms-python.vscode-pylance"
  ]
}
```

This file is ideal for personal per-project overrides.
Add it to `.gitignore` if you don't want to share it with your team.

### Setting Reference

| Setting | Type | Default | Description |
| ------- | ---- | ------- | ----------- |
| `enabled` | boolean | `true` | Master switch. When false, the extension takes no action. |
| `enabledExtensions` | string[] | `[]` | Extension IDs to keep active. Union-merged across all levels. |
| `autoApply` | boolean | `true` | Auto-evaluate and prompt to relaunch on workspace open. |
| `includeBuiltins` | boolean | `false` | When true, built-in extensions are also subject to the allow list. |

## Commands

All commands are available from the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

- **Apply** — Evaluate the config and relaunch
  with only enabled extensions active.
- **Add Extension to Enable List** — Multi-select quick-pick
  of installed extensions not yet on the list.
  Writes to `.vscode/selective-extensions.json`.
- **Remove Extension from Enable List** — Multi-select quick-pick
  showing removable entries (from the dedicated file)
  and read-only entries (from settings.json levels) with source labels.
- **Show Enable List** — Read-only quick-pick
  of all enabled extensions with provenance source labels.
- **Import from Recommendations** — Read `.vscode/extensions.json`
  recommendations and union-merge them into the dedicated file.

## Status Bar

The status bar item shows the enabled extension count:

- `$(extensions) 12 enabled` — normal state, config matches running extensions
- `$(warning) 12 enabled (relaunch needed)` — mismatch detected, relaunch required

Click the status bar item to open the command palette filtered to Selective Extensions commands.

## Multi-Root Workspaces

When a `.code-workspace` file is open, the extension uses `vscode.workspace.workspaceFile`
as the workspace path for relaunch.
Configuration is read from the first workspace folder.

## Known Limitations

- **Relaunch required** — VS Code has no public API to enable/disable extensions at runtime.
  Changes take effect only after relaunching the window.
- **Remote sessions** — the extension detects remote/SSH/WSL sessions and warns
  that relaunch is not supported in these environments.
- **Env var inheritance** — the `SELECTIVE_EXTENSIONS_APPLIED` loop guard env var
  is inherited by terminal sessions in the relaunched window.
  Running `code` from those terminals inherits the suppressed state.
  The extension clears the env var on detection to mitigate this.
- **No first-run onboarding** — on first use you need to manually add extensions
  to the enable list via the command palette or by editing the config files.
- **Extension dependencies** — users must manually include extension dependencies
  in the enable list. The extension does not resolve dependency chains.

## Troubleshooting

### Extensions are not being disabled

- Verify that `selectiveExtensions.enabled` is `true`
  (check all three cascade levels).
- Ensure `enabledExtensions` is not empty —
  the extension takes no action when the list is empty.
- Check the **Selective Extensions** Output Channel
  (`View > Output > Selective Extensions`) for diagnostic messages.

### Loop detection is triggering unexpectedly

The extension sets the `SELECTIVE_EXTENSIONS_APPLIED` environment variable
after relaunching.
If you open a new VS Code window from a terminal inside a relaunched window,
the env var carries over and suppresses the extension.
Close the terminal or unset the variable:

```bash
unset SELECTIVE_EXTENSIONS_APPLIED
```

### Relaunch does not work in remote sessions

The extension detects SSH, WSL, and Dev Container sessions
and displays a warning instead of attempting to relaunch.
The `code` CLI relaunch mechanism is only supported in local desktop windows.

### `code` CLI not found

The relaunch relies on the `code` command being on your `PATH`.
Install it via the command palette:
**Shell Command: Install 'code' command in PATH**.

## FAQ

### Why does the extension union-merge enable lists instead of override?

Union merge lets you build a layered configuration.
A team can share a base set of extensions in workspace settings
while each developer adds personal extras in the dedicated file.
Override semantics would force duplication across levels.

### Do I need to include extension dependencies manually?

Yes.
The extension does not resolve or traverse dependency chains.
If extension A depends on extension B,
add both to your enable list.

### How does this compare to VS Code Profiles?

Profiles bundle settings, keybindings, snippets, and extensions together.
Selective Extensions focuses only on the extension dimension —
it lets you keep your settings and keybindings unchanged
while controlling which extensions are active per workspace.
The two approaches are complementary.

### Why does this require a relaunch?

VS Code does not expose a public API
to enable or disable extensions at runtime.
The only mechanism is relaunching with `--disable-extension` CLI flags,
which is what this extension automates.

## Development

```bash
# Install dependencies
bun install          # or: npm install

# Compile TypeScript
bun run compile      # or: npm run compile

# Bundle for production
bun run bundle       # or: npm run bundle

# Watch mode
bun run watch        # or: npm run watch

# Run tests
bun run test         # or: npm run test

# Lint
bun run lint         # or: npm run lint

# Package .vsix
bun run package      # or: npm run package
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development guidelines.

## License

[MIT](LICENSE)

See [CHANGELOG.md](CHANGELOG.md) for release history.
