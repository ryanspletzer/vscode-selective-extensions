# Selective Extensions - VS Code Extension

A VS Code extension that lets you declare which extensions should be active
per workspace, disabling everything else via CLI relaunch.

## Tech Stack

| Component       | Technology               |
| --------------- | ------------------------ |
| Language        | TypeScript (strict mode) |
| Bundler         | esbuild                  |
| Test framework  | Mocha                    |
| Package manager | Bun (preferred) or npm   |

## Build Commands

Bun is preferred but all commands also work with `npm run`.

```bash
bun install          # Install dependencies
bun run compile      # TypeScript compilation
bun run bundle       # esbuild production bundle
bun run watch        # Watch mode for development
bun run test         # Run Mocha tests
bun run lint         # ESLint
bun run package      # Create .vsix package
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
- Run tests: `bun run test` (or `npm run test`)
- Mocha TDD interface (`suite`/`test`, not `describe`/`it`)

## Key File Paths

| Path                    | Purpose                                     |
| ----------------------- | ------------------------------------------- |
| `spec/spec.md`          | Extension specification                     |
| `src/extension.ts`      | Main extension entry point                  |
| `src/config.ts`         | Three-level config cascade reader           |
| `src/relaunch.ts`       | CLI detection and process execution         |
| `src/commands.ts`       | All 5 command handlers                      |
| `src/statusBar.ts`      | Status bar item management                  |
| `src/loopGuard.ts`      | Env var loop prevention                     |
| `src/logger.ts`         | Output Channel wrapper                      |
| `src/test/`             | Test files                                  |
| `package.json`          | Extension manifest and contribution points  |
| `CHANGELOG.md`          | Keep a Changelog format, update per release |
| `CONTRIBUTING.md`       | Contributor guide and PR guidelines         |
| `README.md`             | User-facing documentation                   |
| `docs/`                 | Brainstorms, plans, solutions, publishing   |
| `SECURITY.md`           | Security policy (private vuln reporting)    |
| `.github/workflows/`    | CI (`ci.yml`) and CodeQL (`codeql.yml`)     |
| `.github/dependabot.yml`| Dependabot config (npm + GitHub Actions)    |
| `esbuild.mjs`           | esbuild bundler config                      |
| `eslint.config.mjs`     | ESLint flat config                          |
| `.vscodeignore`         | Files excluded from .vsix package           |
| `.markdownlint.yaml`    | markdownlint configuration                  |
| `tsconfig.json`         | TypeScript compiler config (strict mode)    |
| `.editorconfig`         | Editor formatting defaults                  |

## Architecture

The extension follows this flow on workspace open:

1. Read config from three-level cascade (user settings.json,
   workspace settings.json, .vscode/selective-extensions.json)
2. Resolve `enabled` (highest-specificity wins); stop if false
3. Merge `enabledExtensions` (union of all levels) plus implicit
   includes (self, active color theme, icon theme); stop if empty
4. Check loop guard env var (`SELECTIVE_EXTENSIONS_APPLIED`);
   stop if already relaunched
5. Compute `disableList = allInstalled - enableList`; stop if empty
6. Detect remote session; skip relaunch if remote
7. Check `autoApply`; stop if false (wait for manual Apply command)
8. Show notification with Apply Now / Skip
9. Relaunch via `code --reuse-window` with `--disable-extension` flags

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

## Changelog

The project maintains a `CHANGELOG.md` following
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format
and [Semantic Versioning](https://semver.org/).

- Update `CHANGELOG.md` for every user-facing change
- Group entries under `Added`, `Changed`, `Deprecated`, `Removed`,
  `Fixed`, or `Security`
- Place new entries under an `[Unreleased]` heading until a version is cut

## CI and Security

GitHub Actions workflows in `.github/workflows/`:

- **`ci.yml`** — runs on push and PR: install, lint, compile, bundle, test
- **`codeql.yml`** — CodeQL static analysis for JavaScript/TypeScript
  (push, PR, weekly schedule)

Dependabot (`.github/dependabot.yml`) opens weekly PRs for npm and
GitHub Actions dependency updates.

Security policy (`SECURITY.md`) directs reporters to GitHub private
vulnerability reporting.

## Git Workflow

- Main branch: `main`
- Feature branches: `feature/<description>`
- Conventional commits preferred
- Run `bun run lint` and `bun run test` before committing
