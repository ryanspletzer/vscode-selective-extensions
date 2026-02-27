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

See the **Development** section in [README.md](README.md) for the full list
of build commands (`compile`, `bundle`, `watch`, `test`, `lint`, `package`).

### Debugging (F5)

1. Open the project in VS Code.
2. Press `F5` to launch the **Extension Development Host**
   (uses the `.vscode/launch.json` configuration).
3. The extension activates on `onStartupFinished` —
   open any folder in the host window to trigger it.
4. Use the **Debug Console** and **Output Channel**
   (`Selective Extensions`) for diagnostic logs.

### Testing Notes

Tests use Mocha with the **TDD interface** (`suite` / `test`,
not `describe` / `it`).
Test files live in `src/test/`.

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
   bun run bundle
   ```

4. Keep PRs focused — one logical change per pull request.

5. Update `CHANGELOG.md` if your change is user-facing.

## Local .vsix Testing

Build and install the extension locally to test end-to-end:

```bash
# Package the extension
bun run package    # or: npm run package

# Install the .vsix
code --install-extension selective-extensions-*.vsix

# Reload VS Code and verify the extension activates
```

To uninstall:

```bash
code --uninstall-extension ryanspletzer.selective-extensions
```

## Questions

Open an [issue](https://github.com/ryanspletzer/vscode-selective-extensions/issues)
for bug reports, feature requests, or questions.
