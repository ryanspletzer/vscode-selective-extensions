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

1. Check `selectiveExtensions.enabled` (user-scope opt-out via `inspect()`)
2. Merge user + workspace `enabledExtensions` lists (union)
3. Check loop prevention flag (env var `SELECTIVE_EXTENSIONS_APPLIED`)
4. Compute `disableList = allInstalled - enableList`
5. Show notification with Apply Now / Skip
6. Relaunch via `code --reuse-window` with `--disable-extension` flags

## Settings Namespace

All settings are under `selectiveExtensions.*`:

- `enabled` (boolean) - master toggle, user-scope opt-out
- `enabledExtensions` (string[]) - allow list of extension IDs
- `autoApply` (boolean) - auto-relaunch on workspace open
- `includeBuiltins` (boolean) - manage built-in extensions too

## Git Workflow

- Main branch: `main`
- Feature branches: `feature/<description>`
- Conventional commits preferred
- Run `npm run lint` and `npm run test` before committing
