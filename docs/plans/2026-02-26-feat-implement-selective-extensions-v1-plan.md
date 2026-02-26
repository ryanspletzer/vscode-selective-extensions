---
title: "feat: Implement Selective Extensions v1"
type: feat
status: active
date: 2026-02-26
origin: docs/brainstorms/2026-02-26-selective-extensions-v1-brainstorm.md
---

# feat: Implement Selective Extensions v1

## Overview

Implement the full v1 of the Selective Extensions VS Code extension:
an allow-list model that declares which extensions should be active
per workspace and relaunches VS Code with `--disable-extension` flags
for everything else.
Configuration is read from a three-level cascade,
and the extension provides command palette commands,
a status bar indicator,
and an Output Channel for diagnostics.

## Problem Statement

VS Code loads every installed extension in every workspace.
There is no built-in mechanism to declaratively specify
which extensions should be active for a given workspace.
This wastes resources, clutters the UI,
and compounds across multiple windows in agentic workflows.
The existing community extension (`vscode-disable-extensions`)
inverts the model with a deny list that scales poorly.

See `spec/spec.md` for the full problem analysis.

## Proposed Solution

A VS Code extension that:

1. Reads an allow list from a three-level config cascade
   (user settings, workspace settings, dedicated JSON file)
2. Computes which installed extensions are not on the list
3. Relaunches VS Code via `code --reuse-window --disable-extension`
   with flags for each unwanted extension
4. Prevents infinite relaunch loops via an environment variable
5. Provides commands for managing the enable list
   and a status bar showing current state

The approach uses only stable, documented VS Code APIs and CLI flags.
See brainstorm for why alternatives (SQLite, Profiles API)
were rejected
(see brainstorm: `docs/brainstorms/2026-02-26-selective-extensions-v1-brainstorm.md`).

## Technical Approach

### Architecture

Flat module structure in `src/`
(see brainstorm: decision 8):

| File | Responsibility |
| ---- | -------------- |
| `extension.ts` | Activate/deactivate, wires all modules together |
| `config.ts` | Three-level cascade reader, merge logic, provenance tracking |
| `relaunch.ts` | CLI variant detection, command builder, process execution |
| `commands.ts` | All 5 command handlers + post-edit relaunch prompt |
| `statusBar.ts` | Status bar item lifecycle, mismatch detection |
| `loopGuard.ts` | Env var check and management |
| `logger.ts` | Output Channel wrapper for diagnostics |

Tests in `src/test/` alongside source.

### Package Manager

**Bun** is the primary package manager for development.
All build scripts and documentation show both `bun` and `npm` commands.
The `package.json` uses standard fields compatible with both.

### Configuration Cascade

Three levels, highest specificity wins for scalars,
union for arrays
(see spec: Configuration Schema):

| Priority | Source | Key format |
| -------- | ------ | ---------- |
| 1 (low) | User `settings.json` | `selectiveExtensions.*` |
| 2 | Workspace `.vscode/settings.json` | `selectiveExtensions.*` |
| 3 (high) | `.vscode/selective-extensions.json` | bare keys (no namespace) |

The config module returns a resolved object + provenance map
so commands can display which level contributed each entry
(see brainstorm: decision 9).

### Activation Flow

```text
1. onStartupFinished fires
2. Read config from all three cascade levels
   - Malformed JSON: warn + fall back to lower levels (decision 21)
   - No workspace: read level 1 only, skip relaunch (decision 17)
3. Resolve enabled (highest-specificity wins)
   - false: log "opted out", stop
4. Compute merged enabledExtensions (union of all levels)
   - Auto-include: self, active color theme, active icon theme (decision 13)
   - empty: log "nothing to enforce", stop
5. Check loop guard env var
   - set: delete from process.env, log "already relaunched", stop
6. Get installed extensions (filter builtins unless includeBuiltins)
7. Compute disableList = installed - enableList
   - empty: log "all extensions are wanted", stop
8. Check autoApply
   - false: log "manual mode", stop (user runs Apply command)
9. Set loop guard env var
10. Show notification with counts:
    "Will disable N extensions, keep M enabled."
    [Apply Now] [Skip]
    - Apply Now: proceed to step 11
    - Skip or dismiss (X/Escape): clear flag, stop (decision 19)
11. Build CLI: <variant> --reuse-window <workspace-path>
    --disable-extension <id1> --disable-extension <id2> ...
    - Variant: code / code-insiders / codium (decision 10)
    - Workspace path: workspaceFile or first folder (decision 22)
12. Execute via child_process.execFile (not exec, to prevent injection)
    - On error: clear loop guard, show error notification
13. Current window replaced by relaunched window
14. Re-activation: step 5 catches flag, stops
```

### Implementation Phases

#### Phase 1: Project Infrastructure

Set up the build toolchain so all subsequent phases
can compile, lint, and run tests.

**Tasks:**

- [ ] Flesh out `package.json`:
  add `main` (`./dist/extension.js`),
  `publisher` (`ryanspletzer`),
  `categories` (`["Other"]`),
  `activationEvents` (`["onStartupFinished"]`),
  `contributes` (commands + configuration schema),
  `scripts` (compile, bundle, watch, test, lint, package),
  `devDependencies`
  (`typescript`, `@types/vscode`, `@types/node`, `@types/mocha`,
  `esbuild`, `eslint`, `@typescript-eslint/eslint-plugin`,
  `@typescript-eslint/parser`,
  `mocha`, `@vscode/test-electron`)
- [ ] Create `tsconfig.json`:
  strict mode, `outDir: ./out`, `target: ES2022`,
  `module: Node16`, `moduleResolution: Node16`,
  `rootDir: ./src`, `lib: ["ES2022"]`
- [ ] Create ESLint config (`eslint.config.mjs`):
  TypeScript rules, VS Code extension patterns
- [ ] Create `.editorconfig`:
  2-space indent, LF line endings, UTF-8,
  trim trailing whitespace, insert final newline
- [ ] Create esbuild build script (`esbuild.mjs`):
  bundle `src/extension.ts` to `dist/extension.js`,
  `external: ['vscode']`, `platform: 'node'`,
  `format: 'cjs'`, `sourcemap: true`
- [ ] Create `.vscodeignore`:
  exclude `src/`, `node_modules/`, `out/`, `.vscode-test/`,
  test files, spec/, docs/, `.code.sh`, `.code.ps1`
- [ ] Run `bun install`,
  verify `bun run compile` and `bun run lint` pass
  on the empty extension entry point

**Success criteria:**

- `bun run compile` produces `out/` with no errors
- `bun run bundle` produces `dist/extension.js`
- `bun run lint` passes with zero warnings
- `bun run test` framework runs (tests may be empty stubs)

#### Phase 2: Core Logic Modules

Implement the core modules with clear testability boundaries.
Pure functions (merge logic, arg building, env var checks)
are directly unit-testable.
Functions that read files or show notifications accept
injected VS Code API dependencies so tests can use stubs.

**Tasks:**

- [ ] `src/logger.ts` — Output Channel wrapper (decision 18)
  - `createLogger(name: string)` returns an object with
    `info()`, `warn()`, `error()` methods
  - Wraps `vscode.window.createOutputChannel()`
  - All other modules accept the logger as a parameter

- [ ] `src/loopGuard.ts` — Env var management (decision 12)
  - `isLoopGuardSet(): boolean` — reads `process.env`
  - `setLoopGuard(): void` — sets the env var
  - `clearLoopGuard(): void` — deletes from `process.env`
  - Pure functions, trivially testable

- [ ] `src/config.ts` — Cascade reader + merge (decisions 9, 17, 21)
  - Types: `CascadeLevel`, `ResolvedConfig`, `ConfigWithProvenance`
  - `readCascade(workspaceFolders?)`:
    reads all three levels, returns raw layers
  - `mergeConfig(layers)`:
    union for `enabledExtensions`, highest-specificity for scalars
  - `resolveProvenance(layers)`:
    maps each extension ID to its contributing level(s)
  - Handles no-workspace (level 1 only)
  - Handles malformed JSON (catch, log warning,
    show notification with "Open File" button, treat as absent)
  - Handles multi-root (iterate all workspace folders for levels 2-3)

- [ ] `src/relaunch.ts` — CLI builder + process execution (decisions 10, 22)
  - `detectCliVariant(): string` — maps `vscode.env.appName`
    to CLI name (`code`, `code-insiders`, `codium`)
  - `resolveCliPath(variant): string` — PATH check + fallback
    to platform-specific paths
  - `buildArgs(workspacePath, disableIds): string[]` —
    constructs the argument array
    (`['--reuse-window', workspacePath, '--disable-extension', id1, ...]`)
  - `resolveWorkspacePath(): string` — uses `workspaceFile` when
    available, falls back to first folder
  - `executeRelaunch(cliPath, args): Promise<void>` —
    `child_process.execFile` wrapper with error handling
    (execFile prevents shell injection; args passed as array)

**Success criteria:**

- `config.ts` merge logic has 100% branch coverage in unit tests
- `loopGuard.ts` has full unit test coverage
- `relaunch.ts` command builder has unit tests
  for all three CLI variants and both workspace path types
- All modules accept injected dependencies (logger, VS Code API stubs)
  for testability

#### Phase 3: Extension Entry Point

Wire the activation flow using the core modules.

**Tasks:**

- [ ] `src/extension.ts` — `activate()` implementation
  - Follow the 14-step activation flow exactly
  - Wire logger, config, loopGuard, relaunch modules
  - Register all command disposables on `context.subscriptions`
  - Create and register status bar item
  - Detect remote sessions via `vscode.env.remoteName` (decision 11)
  - Auto-include self + active themes in enable list (decision 13):
    iterate `vscode.extensions.all`, inspect
    `contributes.themes` and `contributes.iconThemes`
    manifest entries to find the extensions providing
    the active color theme and icon theme
  - `deactivate()` — dispose logger

- [ ] Compute mismatch state at activation for status bar (decision 7):
  compare the resolved enable list against currently active extensions

**Success criteria:**

- Extension activates without errors on workspace open
- Loop guard prevents infinite relaunch
- Remote sessions show a one-time warning notification
- Output Channel logs each decision point

#### Phase 4: Commands and Status Bar

Implement the 5 commands and the status bar item.

**Tasks:**

- [ ] `src/commands.ts` — all command handlers

  - `apply`: read config, compute disable list,
    show confirmation notification with counts (decision 20),
    relaunch on confirm
  - `addExtension`: multi-select quick-pick (decision 3)
    of installed extensions not on the list,
    display name as label + ID as detail (decision 5),
    write to `.vscode/selective-extensions.json`,
    prompt to relaunch (decision 4)
  - `removeExtension`: multi-select quick-pick (decision 3),
    show level-3 entries as removable,
    show level-1/2 entries as read-only with source label (decision 16),
    write to `.vscode/selective-extensions.json`,
    prompt to relaunch (decision 4)
  - `showList`: read-only quick-pick with source labels (decision 6),
    use provenance data from config module
  - `importRecommendations`: read `.vscode/extensions.json`,
    union merge into `.vscode/selective-extensions.json`,
    show info notification if file missing or empty

- [ ] `src/statusBar.ts` — status bar lifecycle

  - Create `StatusBarItem` with `$(extensions) N enabled` format
  - Mismatch state: switch to `$(warning) N enabled (relaunch needed)`
    with warning background color (decision 7)
  - Click action: open command palette filtered to
    Selective Extensions commands
  - Visibility: shown only when enabled and list non-empty
  - Expose `update(config)` method for commands to refresh state

**Success criteria:**

- All 5 commands appear in the command palette
- Add/Remove quick-picks show display names with IDs
- Remove quick-pick distinguishes removable vs. read-only entries
- Status bar shows correct count and mismatch state
- Post-edit prompt offers [Relaunch] / [Later]

#### Phase 5: Testing

Write unit and integration tests.

**Tasks:**

- [ ] `src/test/config.test.ts` — config cascade merge
  - Empty config at all levels
  - Single level populated
  - All three levels with union merge
  - Scalar override (highest specificity wins)
  - Malformed JSON handling
  - No-workspace fallback (level 1 only)
  - Multi-root workspace merge
  - Provenance tracking correctness

- [ ] `src/test/loopGuard.test.ts` — loop guard
  - Set, check, clear cycle
  - Check when not set

- [ ] `src/test/relaunch.test.ts` — CLI builder
  - Command construction for each CLI variant
  - Workspace file path vs. folder path
  - Disable list with various sizes (0, 1, many)

- [ ] `src/test/commands.test.ts` — light integration
  - Command registration verification
  - Config file write operations (add, remove, import)

- [ ] `src/test/statusBar.test.ts` — status bar
  - Count display
  - Mismatch indicator toggle
  - Visibility rules

**Success criteria:**

- `bun run test` passes all tests
- Config merge logic has comprehensive branch coverage
- All test files follow Mocha `describe`/`it` patterns
- Tests use VS Code API stubs, not real API calls

#### Phase 6: Polish and Packaging

Final polish, documentation, and .vsix packaging.

**Tasks:**

- [ ] Update CLAUDE.md if any conventions changed during implementation
- [ ] Create `README.md` with:
  - Feature overview
  - Installation (marketplace + `.vsix`)
  - Quick start guide (manual first-run flow)
  - Configuration reference (all 4 settings + cascade explanation)
  - Command reference (all 5 commands)
  - Status bar explanation
  - Multi-root workspace behavior
  - Known limitations (remote sessions, env var inheritance,
    no first-run onboarding)
  - Bun and npm command examples side by side
- [ ] Create `CHANGELOG.md` with v0.0.1 initial release entry
- [ ] Run `bun run package` to produce `.vsix`
- [ ] Manually test the `.vsix` in a real VS Code window
- [ ] Update `.vscode/settings.json` to wire test explorer
  for Mocha adapter (if needed for dev DX)

**Success criteria:**

- `bun run package` produces a valid `.vsix`
- Extension installs from `.vsix` and activates correctly
- README covers all user-facing functionality
- All scripts work: compile, bundle, watch, test, lint, package

## Alternative Approaches Considered

| Approach | Why rejected |
| -------- | ------------ |
| SQLite (`state.vscdb`) manipulation | Fragile, undocumented schema, locking risks |
| VS Code Profiles API | Does not exist yet (proposed in microsoft/vscode#211890) |
| Deny-list model | Scales poorly; list grows with every new extension |
| `excludedExtensions` schema addition | YAGNI for v1; remove uses scoped quick-pick (decision 16) |
| workspaceState loop fallback | YAGNI; env var is sufficient and better scoped (decision 12) |
| `child_process.exec` for relaunch | Shell injection risk; use `execFile` with args array instead |

## System-Wide Impact

### Interaction Graph

```text
onStartupFinished
  -> activate()
    -> config.readCascade() -> reads 3 JSON files
    -> loopGuard.isLoopGuardSet() -> reads process.env
    -> statusBar.create() -> creates StatusBarItem
    -> relaunch.executeRelaunch() -> spawns child process
      -> new VS Code window (inherits env vars)
        -> activate() -> loopGuard detects flag -> stops
```

### Error Propagation

| Error source | Handler | User impact |
| ------------ | ------- | ----------- |
| Malformed JSON (level 3) | config.ts catches, logs, notifies | Falls back to levels 1-2 |
| CLI not on PATH | relaunch.ts logs, shows error notification | No relaunch, user guided to fix |
| Process execution failure | relaunch.ts clears loop guard, shows error | No relaunch, can retry |
| Extension API error | activate() catch block, logs to Output Channel | Graceful degradation |

### State Lifecycle Risks

- **Loop guard env var inheritance**: The env var is inherited by
  terminal sessions inside the relaunched VS Code.
  Any `code` command from those terminals inherits the suppressed state.
  Documented as a known limitation.
  Mitigation: `delete process.env.SELECTIVE_EXTENSIONS_APPLIED`
  on detection clears it for in-process reads.

### API Surface Parity

The extension contributes:

- 5 commands (all via `contributes.commands` in `package.json`)
- 4 settings (via `contributes.configuration`)
- 1 status bar item (programmatic, not via `contributes`)
- 1 Output Channel (programmatic)

### Integration Test Scenarios

1. Config cascade with all three levels populated:
   verify union merge and scalar override
2. Activation with loop guard set:
   verify no relaunch, flag cleared
3. Add extension via command:
   verify file written, relaunch prompted
4. Remote session detection:
   verify relaunch skipped, notification shown
5. Malformed JSON at level 3:
   verify fallback to levels 1-2, warning shown

## Acceptance Criteria

### Functional Requirements

- [ ] Extension activates on `onStartupFinished`
- [ ] Reads config from all three cascade levels
- [ ] Merges `enabledExtensions` via union across all levels
- [ ] Resolves `enabled`, `autoApply`, `includeBuiltins`
  via highest-specificity-wins
- [ ] Auto-includes self, active color theme, and active icon theme
  in the enable list
- [ ] Computes disable list = installed - enable list
- [ ] Shows notification with disable/keep counts
  when mismatch detected and autoApply is true
- [ ] Relaunches via CLI with `--reuse-window --disable-extension` flags
- [ ] Detects VS Code variant (stable, Insiders, Codium)
  and uses correct CLI name
- [ ] Uses `.code-workspace` file path for multi-root workspaces
- [ ] Prevents infinite relaunch via `SELECTIVE_EXTENSIONS_APPLIED` env var
- [ ] Notification dismiss (X/Escape) treated as Skip
- [ ] All 5 commands registered and functional
- [ ] Remove command shows level-3 entries as removable,
  level-1/2 as read-only
- [ ] Status bar shows count + mismatch indicator
- [ ] Output Channel logs all key decisions
- [ ] Detects remote sessions and skips auto-relaunch with notification
- [ ] No-workspace windows read level-1 only, no relaunch
- [ ] Malformed JSON at any level: warn, fall back, continue
- [ ] First-run with no config: silent, no action

### Non-Functional Requirements

- [ ] TypeScript strict mode, zero `any` types
- [ ] esbuild bundle under 50 KB
- [ ] Activation time under 50 ms (no heavy I/O on hot path
  beyond JSON reads)
- [ ] No runtime dependencies (pure VS Code API + Node.js builtins)
- [ ] Process execution uses `execFile` (not `exec`) to prevent injection

### Quality Gates

- [ ] `bun run lint` passes with zero warnings
- [ ] `bun run test` passes all tests
- [ ] Config merge logic has comprehensive branch coverage
- [ ] `.vsix` installs and activates cleanly
- [ ] README documents all features and known limitations

## Success Metrics

- Relaunch completes in under 3 seconds on a typical system
- No infinite relaunch loops in any tested scenario

Functional correctness is covered by Acceptance Criteria above.

## Dependencies and Prerequisites

| Dependency | Purpose | Version |
| ---------- | ------- | ------- |
| VS Code | Runtime host | ^1.95.0 |
| TypeScript | Language | ^5.x |
| esbuild | Bundler | ^0.24.x |
| Mocha | Test framework | ^10.x |
| `@vscode/test-electron` | Integration test runner | ^2.x |
| ESLint | Linter | ^9.x |
| `@typescript-eslint/*` | TS ESLint rules | ^8.x |

No runtime dependencies.
All dependencies are devDependencies.

## Risk Analysis and Mitigation

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| `code` CLI not on PATH | Medium | Blocks relaunch | Fallback to known paths + clear error |
| Env var inherited by terminals | Medium | Suppresses in child windows | Document as known limitation |
| Theme extension detection fails | Low | Themes lost on relaunch | Fall back; user adds manually |
| Multi-root workspace path wrong | Low | Loses multi-root on relaunch | Use `workspaceFile` when available |
| VS Code API changes | Low | Breaking changes | Pin minimum version, test against stable |

## Future Considerations

These are explicitly out of scope for v1 but inform architecture:

- **SQLite persistence**: Write to `state.vscdb` for session-persistent state
- **Profiles API**: Switch profiles instead of CLI flags when API lands
- **Extension dependency resolution**: Auto-include transitive dependencies
- **Workspace Trust integration**: Restrict activation in untrusted workspaces
- **First-run onboarding**: Welcome notification or VS Code walkthrough
- **`excludedExtensions` setting**: Override-subtract from merged union

The flat module architecture accommodates all of these
without structural changes.

## Documentation Plan

| Document | Action |
| -------- | ------ |
| `README.md` | Create: full user-facing documentation |
| `CHANGELOG.md` | Create: v0.0.1 initial release |
| `CLAUDE.md` | Update if conventions change (e.g., Bun as primary PM) |
| `spec/spec.md` | Update to reflect SpecFlow gap resolutions (decisions 16-23) |

## Sources and References

### Origin

- **Brainstorm document**:
  [docs/brainstorms/2026-02-26-selective-extensions-v1-brainstorm.md](../brainstorms/2026-02-26-selective-extensions-v1-brainstorm.md)
  Key decisions carried forward: config API with provenance (decision 9),
  flat module architecture (decision 8),
  env var loop guard only (decision 12),
  implicit theme includes (decision 13),
  CLI variant detection (decision 10),
  Output Channel addition (decision 18),
  remove command scoping (decision 16).

### Internal References

- Extension specification: `spec/spec.md`
- Project conventions: `CLAUDE.md`
- Dev tool recommendations: `.vscode/extensions.json`

### External References

- VS Code Extension API:
  <https://code.visualstudio.com/api>
- VS Code CLI reference:
  <https://code.visualstudio.com/docs/editor/command-line>
- esbuild for VS Code extensions:
  <https://code.visualstudio.com/api/working-with-extensions/bundling-extension>
- Profiles API proposal:
  <https://github.com/microsoft/vscode/issues/211890>
