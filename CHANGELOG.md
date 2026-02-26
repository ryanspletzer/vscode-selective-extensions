# Changelog

All notable changes to the Selective Extensions extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2026-02-26

### Added

- Three-level configuration cascade (user settings, workspace settings, dedicated file)
- Union merge for `enabledExtensions` across all cascade levels
- Highest-specificity-wins for scalar settings (`enabled`, `autoApply`, `includeBuiltins`)
- Five command palette commands: Apply, Add Extension, Remove Extension, Show List, Import Recommendations
- Status bar indicator with enabled count and mismatch warning
- Implicit includes for self, active color theme, and active icon theme
- Loop prevention via `SELECTIVE_EXTENSIONS_APPLIED` environment variable
- Remote session detection with warning notification
- Multi-root workspace support via `workspaceFile` path
- Malformed JSON handling with fallback to levels 1-2
- Config provenance tracking showing which cascade level contributed each extension
- Output Channel logging (`Selective Extensions`)
