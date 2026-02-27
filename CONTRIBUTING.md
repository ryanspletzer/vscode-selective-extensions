# Contributing to Selective Extensions

Thank you for your interest in contributing.
This guide covers everything you need to get started.

## Prerequisites

| Tool | Version | Notes |
| ---- | ------- | ----- |
| Node.js | 18+ | Required for VS Code extension development |
| Bun | latest | Preferred package manager (npm also works) |
| VS Code | 1.95+ | Minimum engine version for this extension |
| Git | 2.x | For version control |

## Getting Started

1. Fork the repository on GitHub.
2. Clone your fork:

   ```bash
   git clone https://github.com/<your-username>/vscode-selective-extensions.git
   cd vscode-selective-extensions
   ```

3. Install dependencies:

   ```bash
   bun install    # or: npm install
   ```

4. Compile TypeScript:

   ```bash
   bun run compile    # or: npm run compile
   ```

5. Open the project in VS Code:

   ```bash
   code .
   ```

## Development Workflow

### Watch Mode

Run the TypeScript compiler in watch mode for automatic recompilation:

```bash
bun run watch    # or: npm run watch
```

### Debugging (F5)

1. Open the project in VS Code.
2. Press `F5` to launch the **Extension Development Host**.
3. The extension activates on `onStartupFinished` —
   open any folder in the host window to trigger it.
4. Use the **Debug Console** and **Output Channel**
   (`Selective Extensions`) for diagnostic logs.

### Linting

```bash
bun run lint    # or: npm run lint
```

ESLint is configured in `eslint.config.mjs`.
Fix all warnings and errors before submitting a PR.

### Testing

```bash
bun run test    # or: npm run test
```

Tests use Mocha with the **TDD interface** (`suite` / `test`,
not `describe` / `it`).
Test files live in `src/test/`.

## Project Structure

| Path | Purpose |
| ---- | ------- |
| `src/extension.ts` | Main entry point (activate / deactivate) |
| `src/config.ts` | Three-level configuration cascade reader |
| `src/relaunch.ts` | CLI detection and child process execution |
| `src/commands.ts` | All five command handlers |
| `src/statusBar.ts` | Status bar item management |
| `src/loopGuard.ts` | Env var loop prevention |
| `src/logger.ts` | Output Channel wrapper |
| `src/test/` | Mocha test files |
| `spec/spec.md` | Extension specification |
| `package.json` | Extension manifest and contribution points |
| `esbuild.mjs` | Production bundler configuration |
| `tsconfig.json` | TypeScript compiler options |
| `eslint.config.mjs` | ESLint configuration |

## Code Style

- **TypeScript strict mode** — `"strict": true` in `tsconfig.json`
- Follow VS Code extension API patterns and conventions
- Use `async` / `await` over raw Promises
- Mocha TDD interface for tests (`suite` / `test`)
- Prefer descriptive variable names; avoid single-letter names
  outside loop counters

## Pull Request Guidelines

1. Create a feature branch from `main`:

   ```bash
   git checkout -b feature/<description>
   ```

2. Use [conventional commits](https://www.conventionalcommits.org/):
   - `feat:` — new feature
   - `fix:` — bug fix
   - `docs:` — documentation only
   - `refactor:` — code change that neither fixes a bug nor adds a feature
   - `test:` — adding or updating tests
   - `ci:` — CI/CD changes

3. Before pushing, verify your changes:

   ```bash
   bun run lint
   bun run test
   bun run compile
   ```

4. Keep PRs focused — one logical change per pull request.

5. Update `CHANGELOG.md` if your change is user-facing.

## Local .vsix Testing

Build and install the extension locally to test end-to-end:

```bash
# Package the extension
bun run package    # or: npm run package

# Install the .vsix
code --install-extension selective-extensions-0.0.1.vsix

# Reload VS Code and verify the extension activates
```

To uninstall:

```bash
code --uninstall-extension ryanspletzer.selective-extensions
```

## Questions

Open an [issue](https://github.com/ryanspletzer/vscode-selective-extensions/issues)
for bug reports, feature requests, or questions.
