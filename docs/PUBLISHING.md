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

## CI/CD Publishing (Future)

A GitHub Actions workflow can automate publishing on tagged releases:

1. Create a repository secret `VSCE_PAT` with your Azure DevOps PAT.
2. Add a workflow triggered on version tags (`v*`).
3. The workflow runs tests, bundles, and calls `vsce publish`.

Example trigger:

```yaml
on:
  push:
    tags:
      - 'v*'
```

This is not yet implemented.
See the `.github/workflows/` directory for the existing CI workflow
that can be extended.
