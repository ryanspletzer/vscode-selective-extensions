# Selective Extensions v1 - Design Brainstorm

**Date**: 2026-02-26
**Status**: Complete
**Spec**: `spec/spec.md`

## What We're Building

A VS Code extension that enforces an allow-list model for extensions:
declare which extensions should be active per workspace,
and the extension relaunches VS Code with `--disable-extension` flags
for everything else.
Configuration is read from a three-level cascade
(user settings, workspace settings, dedicated JSON file).

## Why This Approach

The CLI relaunch approach was chosen because:

- VS Code has no public API for enabling/disabling extensions at runtime
- SQLite manipulation (`state.vscdb`) is fragile and undocumented
- The Profiles API doesn't exist yet (proposed in microsoft/vscode#211890)
- `--disable-extension` is a stable, documented CLI flag

Alternatives (SQLite, profiles) are tracked as future considerations
in the spec.

## Key Decisions

### UX and Interaction Design

1. **Notification behavior**: No timeout.
   The mismatch notification stays until the user clicks
   [Apply Now] or [Skip].
   Simple and predictable.

2. **Notification content**: Show counts.
   "Selective Extensions will disable 12 extensions and keep 8 enabled."
   Gives the user confidence without overwhelming them with a full list.

3. **Quick-pick selection**: Multi-select for both Add and Remove commands.
   Faster for initial setup when adding many extensions at once.

4. **Post-edit relaunch prompt**: After adding or removing extensions
   via commands, prompt with "Configuration updated. Relaunch now to apply?"
   with [Relaunch] / [Later] buttons.
   [Later] just dismisses — changes apply on next workspace open via autoApply.

5. **Extension display in quick-picks**: Display name as label,
   extension ID as detail/description.
   Readable for scanning, unambiguous for identification.

6. **Show List format**: Read-only quick-pick with source labels.
   Each item shows the extension display name
   and which cascade level(s) contributed it.

7. **Status bar**: Show `$(extensions) N enabled` normally.
   When the current session has a mismatch
   (extensions that should be disabled are still active),
   switch to `$(warning) N enabled (relaunch needed)`
   with a warning color.
   Mismatch state is computed once at activation — no file watchers
   or config change listeners in v1.
   If the user edits config after activation,
   the status bar updates when they run a command
   (Add, Remove, or Apply) that re-reads config.

### Architecture and Module Structure

1. **Code organization**: Flat modules in `src/`.

   | File | Responsibility |
   | ---- | -------------- |
   | `extension.ts` | Activate/deactivate, wires everything together |
   | `config.ts` | Three-level cascade reader + merge logic |
   | `relaunch.ts` | CLI command builder + child_process exec |
   | `commands.ts` | All 5 command handlers |
   | `statusBar.ts` | Status bar item lifecycle |
   | `loopGuard.ts` | Env var check for loop prevention |

2. **Config API**: The cascade reader returns both a resolved config object
   AND per-setting provenance (which level each value came from).
   The `showList` command needs source info per extension,
   so this data must be available from the config layer.

### Edge Cases and Robustness

1. **CLI discovery**: Detect which VS Code variant is running
    (stable, Insiders, Codium) via `vscode.env.appName`
    and use the corresponding CLI name
    (`code`, `code-insiders`, `codium`).
    Try the resolved CLI name on PATH first.
    If not found, fall back to platform-specific default install paths
    (`/usr/local/bin/code` on macOS, `Program Files` on Windows).
    Show a clear error message if not found anywhere.

2. **Remote session handling**: Detect via `vscode.env.remoteName`.
    If set, skip automatic relaunch and show a one-time notification
    explaining why.
    The manual `Apply` command is still available but warns
    that it may not work correctly in remote contexts.

3. **Loop prevention**: Env var only (`SELECTIVE_EXTENSIONS_APPLIED=1`).
    No workspaceState fallback in v1.
    The env var is scoped to the child process
    and doesn't persist across unrelated window opens.
    YAGNI on the fallback.

4. **Implicit includes**: The extension always auto-includes itself,
    the active color theme, and the active icon theme.
    Forgetting themes is a common gotcha
    that would break the UI appearance on relaunch.
    Implementation note: map from active theme name to extension ID
    by iterating `vscode.extensions.all` and inspecting
    each extension's `contributes.themes` manifest entries.

5. **Large disable lists**: No limit or warning.
    The CLI can handle many `--disable-extension` flags.
    Modern OS command-line limits are generous enough
    for any realistic extension count.

### Testing Strategy

1. **Test focus**: Unit tests for pure logic,
    minimal integration tests.
    - Thorough unit tests for config cascade merge,
      loop guard, CLI command building
    - Light integration tests for command registration
    - Skip full relaunch e2e in v1 (hard to test, low ROI)

### SpecFlow Gap Resolutions

The following decisions were made during planning
to resolve gaps identified by SpecFlow analysis.

1. **Remove command scope**: The remove quick-pick shows level-3 entries
    as removable. Entries from levels 1 and 2 appear as read-only
    with a note to edit those files manually. No schema change needed.

2. **No-workspace windows**: Read user-level config only (level 1).
    Skip levels 2 and 3. Show status bar if configured.
    No relaunch — nothing meaningful to relaunch to.

3. **Output Channel**: Add a "Selective Extensions" Output Channel.
    Log key decisions (why it stopped, CLI command built, errors).
    New module: `logger.ts`.

4. **Notification dismissal**: Treat X button / Escape identically
    to Skip — clear loop guard flag, take no action.

5. **Manual Apply confirmation**: Show the same confirmation notification
    as autoApply (counts + [Apply Now] / [Skip]).
    Consistent UX, no surprise relaunches.

6. **Malformed JSON handling**: Log warning to Output Channel,
    show a warning notification with an "Open File" button,
    treat the file as absent and continue with levels 1 and 2.

7. **Multi-root workspace path**: Use `vscode.workspace.workspaceFile`
    when available (`.code-workspace` file).
    Fall back to first folder path for single-folder workspaces.

8. **First-run onboarding**: Out of scope for v1. No onboarding.
    Document the manual first-run flow in the README.

## Open Questions

*None remaining — all 23 decisions were resolved
during the brainstorm and planning phases.*
