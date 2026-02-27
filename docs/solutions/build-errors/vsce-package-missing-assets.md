# Fix missing extension icon causing vsce package validation failure

---

- **date**: 2026-02-26
- **category**: build-errors
- **tags**: ci, packaging, asset-validation, vsce, marketplace-metadata
- **severity**: medium
- **time_to_resolve**: 15 minutes
- **components**: CI pipeline, package.json, images directory
- **symptoms**:
  - `The specified icon 'extension/images/icon.png' wasn't found in the extension`
  - `script "package" exited with code 1`

---

## Problem

GitHub Actions CI build failed at the `bun run package` step with:

```text
The specified icon 'extension/images/icon.png' wasn't found in the extension.
error: script "package" exited with code 1
```

The CI pipeline was unable to package the extension
because a declared asset was missing.

## Root Cause

`package.json` declared `"icon": "images/icon.png"`
as part of marketplace metadata additions in a docs PR,
but the actual PNG file was never committed to the repository.
The `images/` directory existed with a `README.md`
documenting icon requirements,
but contained no actual icon file.

The `vsce package` command (via `@vscode/vsce`) validates
that all referenced assets physically exist before creating the .vsix,
causing the build to fail.

The implementation plan had noted
"will warn about missing icon, which is expected" —
but `vsce package` treats a missing icon as a fatal error, not a warning.

## Solution

Generated a 256x256 placeholder PNG programmatically
using Python's standard library (no external dependencies):

- **`struct` module** — binary PNG chunk encoding
  (signature, IHDR, IDAT, IEND)
- **`zlib` module** — IDAT pixel data compression
- **Design** — dark background (#1E1E1E) matching `galleryBanner.color`
  with blue accent (#007ACC) "SE" initials and border
- **Output** — 913-byte PNG at `images/icon.png`

This approach required no external tools (ImageMagick, Pillow, etc.)
and produced a valid, visually consistent placeholder.

## Verification Steps

1. Validated PNG structure: `file images/icon.png` returned
   `PNG image data, 256 x 256, 8-bit/color RGB, non-interlaced`
2. Verified dimensions: `sips -g pixelWidth -g pixelHeight images/icon.png`
   confirmed 256x256
3. Visual inspection via Read tool confirmed correct rendering
4. Local package test: `bun run package` succeeded,
   producing a 14.59 KB .vsix containing the icon
5. Pushed to GitHub — CI build passed

## Prevention Strategies

- **Always commit referenced assets with the manifest change.**
  If `package.json` gains a new file-path field (`icon`, etc.),
  the referenced file must exist in the same commit or earlier.
  A placeholder is acceptable; a missing file is not.
- **Run `bun run package` locally before pushing.**
  The full packaging step catches asset validation errors
  that `compile` and `bundle` do not.
- **Split metadata PRs carefully.**
  Documentation-only PRs that touch `package.json`
  can still break CI.
  Plan accordingly and validate the full build locally.
- **Add a CI validation step before packaging** (future improvement).
  A lightweight script that checks all `package.json`
  file-path references exist would surface issues
  earlier in the pipeline.

## Lessons Learned

- **Manifest fields are not optional suggestions.**
  In VS Code extension packaging,
  any file path declared in `package.json` must be present.
  Missing assets fail hard, not gracefully.
- **"Expected warning" assumptions need CI verification.**
  The plan assumed a warning;
  `vsce` treated it as a fatal error.
  Always verify CI behavior matches assumptions.
- **Python stdlib can generate valid PNGs.**
  When image tools (ImageMagick, Pillow) are unavailable,
  `struct` + `zlib` can produce valid PNG files
  for simple graphics like placeholder icons.

## Related Resources

- `docs/PUBLISHING.md` — Pre-publish checklist
  (line 25: icon must exist at `images/icon.png`)
- `images/README.md` — Icon format requirements
  (256x256 PNG, square, no SVG)
- `.github/workflows/ci.yml` — CI workflow
  running `bun run package` at line 36-37
- `.vscodeignore` — Excludes `images/README.md`
  but ships `images/icon.png`
- PR [#3](https://github.com/ryanspletzer/vscode-selective-extensions/pull/3) —
  The docs PR where this issue occurred
