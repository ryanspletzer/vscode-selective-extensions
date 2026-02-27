# Extension Icon

Place your extension icon in this directory as `icon.png`.

## Requirements

| Property | Value |
| -------- | ----- |
| Filename | `icon.png` |
| Format | PNG only (SVG is not supported by vsce) |
| Minimum size | 128x128 pixels |
| Recommended size | 256x256 pixels |
| Shape | Square (1:1 aspect ratio) |
| Background | Transparent or solid |

## Notes

- The icon is referenced by `"icon": "images/icon.png"` in `package.json`.
- It appears on the VS Code Marketplace listing page,
  in the Extensions sidebar, and in search results.
- Use a simple, recognizable design that reads well at small sizes.
- Avoid text-heavy icons; they become illegible at 32x32 rendering.
