# Selective Extensions - VS Code Extension

A VS Code extension that lets you declare which extensions should be active
per workspace, disabling everything else via CLI relaunch.

## Tech Stack

| Component       | Technology               |
| --------------- | ------------------------ |
| Language        | TypeScript (strict mode) |
| Bundler         | esbuild                  |
| Test framework  | Mocha                    |
| Package manager | npm                      |

## Build Commands

```bash
npm install          # Install dependencies
npm run compile      # TypeScript compilation
npm run bundle       # esbuild production bundle
npm run watch        # Watch mode for development
npm run test         # Run Mocha tests
npm run lint         # ESLint
npm run package      # Create .vsix package
```

## Code Style

- TypeScript strict mode (`"strict": true` in tsconfig)
- Follow VS Code extension API patterns and conventions
- Use `vscode.workspace.getConfiguration()` for settings access
- Use `vscode.commands.registerCommand()` for command registration
- Activation event: `onStartupFinished`
- Prefer async/await over raw Promises
- Use `vscode.ExtensionContext` for lifecycle management

## Testing

- Unit tests with Mocha
- VS Code extension integration tests via `@vscode/test-electron`
- Test files live alongside source in `src/test/`
- Run tests: `npm run test`

## Key File Paths

| Path               | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `spec/spec.md`     | Extension specification                    |
| `src/extension.ts` | Main extension entry point                 |
| `src/test/`        | Test files                                 |
| `package.json`     | Extension manifest and contribution points |
| `.vscodeignore`    | Files excluded from .vsix package          |

## Architecture

The extension follows this flow on workspace open:

1. Read config from three-level cascade (user settings.json,
   workspace settings.json, .vscode/selective-extensions.json)
2. Resolve `enabled` (highest-specificity wins); stop if false
3. Merge `enabledExtensions` (union of all levels); stop if empty
4. Check loop prevention flag (env var `SELECTIVE_EXTENSIONS_APPLIED`)
5. Compute `disableList = allInstalled - enableList`
6. Show notification with Apply Now / Skip
7. Relaunch via `code --reuse-window` with `--disable-extension` flags

## Configuration Cascade

Three levels, highest specificity wins for scalars, union for arrays:

| Priority | Source                              | Audience             |
| -------- | ----------------------------------- | -------------------- |
| 1 (low)  | User `settings.json`                | Personal global base |
| 2        | Workspace `.vscode/settings.json`   | Team / shared        |
| 3 (high) | `.vscode/selective-extensions.json` | Personal per-project |

Settings in `settings.json` use the `selectiveExtensions.*` namespace.
The dedicated file uses bare keys (no namespace).

Settings: `enabled`, `enabledExtensions`, `autoApply`, `includeBuiltins`

## Git Workflow

- Main branch: `main`
- Feature branches: `feature/<description>`
- Conventional commits preferred
- Run `npm run lint` and `npm run test` before committing
