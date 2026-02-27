# Publishing to the VS Code Marketplace

This guide covers how to publish Selective Extensions
to the VS Code Marketplace using `vsce`.

## Prerequisites

1. **Azure DevOps Personal Access Token (PAT)**
   - Go to [dev.azure.com](https://dev.azure.com)
   - Create a PAT with the **Marketplace (Manage)** scope
   - Save the token securely; you will need it for `vsce login`

2. **Publisher account**
   - Register at the
     [VS Code Marketplace publisher management page](https://marketplace.visualstudio.com/manage)
   - The publisher ID must match `"publisher"` in `package.json`
     (currently `ryanspletzer`)

3. **vsce installed**
   - Already included as a dev dependency (`@vscode/vsce`)
   - Use via `npx vsce` or install globally: `npm install -g @vscode/vsce`

## Pre-Publish Checklist

- [ ] Extension icon exists at `images/icon.png`
      (256x256 PNG recommended)
- [ ] `README.md` screenshots are added and uncommented
- [ ] `README.md` marketplace badges are uncommented
- [ ] Version is bumped in `package.json`
      (and `CHANGELOG.md` is updated)
- [ ] All tests pass: `bun run test`
- [ ] Linting passes: `bun run lint`
- [ ] Bundle builds: `bun run bundle`
- [ ] Package builds: `bun run package`
- [ ] `.vsix` installs and works correctly in a local VS Code window

## Publishing Commands

### Log In

```bash
npx vsce login ryanspletzer
```

You will be prompted for your PAT.

### Publish

```bash
npx vsce publish --no-dependencies
```

The `--no-dependencies` flag skips bundling `node_modules`
since the extension is pre-bundled with esbuild.

The `vscode:prepublish` script in `package.json` runs `npm run bundle`
automatically before packaging.

### Version Bump Shortcuts

`vsce publish` can bump the version automatically:

```bash
npx vsce publish patch --no-dependencies    # 0.0.1 -> 0.0.2
npx vsce publish minor --no-dependencies    # 0.0.2 -> 0.1.0
npx vsce publish major --no-dependencies    # 0.1.0 -> 1.0.0
```

This updates `package.json` and publishes in one step.
Create a git tag manually if desired.

## Package Inspection

Before publishing, inspect the `.vsix` contents to verify
nothing unexpected is included:

```bash
npx vsce ls
```

This lists every file that would be packaged.
Cross-reference with `.vscodeignore` to ensure
source code, tests, and dev files are excluded.

## Automated Release Workflow

The `.github/workflows/release.yml` workflow automates publishing
when a `v*` tag is pushed.

### What the workflow does

1. **Validate** — extracts the version from the tag,
   validates strict semver (`vX.Y.Z`),
   and detects pre-release via odd minor version
   (e.g., `v0.3.0` is pre-release, `v1.0.0` is stable)
2. **CI** — runs lint, compile, test, and bundle (mirrors `ci.yml`)
3. **Publish** — bumps `package.json` version (build-time only),
   packages the `.vsix`,
   publishes to VS Code Marketplace and Open VSX Registry,
   and creates a GitHub Release with the `.vsix` attached

### Required secrets

| Secret     | Source                    | Scope                                     |
| ---------- | ------------------------- | ----------------------------------------- |
| `VSCE_PAT` | Azure DevOps PAT          | Marketplace (Manage), all accessible orgs |
| `OVSX_PAT` | open-vsx.org access token | Publish access                            |

`GITHUB_TOKEN` is provided automatically via the workflow's
`permissions: contents: write` block.

### One-time Open VSX setup

The `ryanspletzer` namespace must be claimed on
[open-vsx.org](https://open-vsx.org) before the first publish.

### How to release

1. Ensure `CHANGELOG.md` is up to date and the `[Unreleased]` section
   is ready to become a versioned entry
2. Bump the version in `package.json` locally
   (or let the workflow handle it from the tag)
3. Commit, then create and push a tag:

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. The workflow runs automatically — monitor it in the
   [Actions tab](https://github.com/ryanspletzer/vscode-selective-extensions/actions)
5. On success, the extension appears on both marketplaces
   and a GitHub Release is created with the `.vsix` asset
