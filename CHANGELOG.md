# Changelog

All notable changes to the Selective Extensions extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Auto-update workflow for `bun.lock` on Dependabot PRs (`dependabot-bun-lock.yml`)
- CodeQL static analysis workflow for JavaScript/TypeScript
- Dependabot configuration for npm and GitHub Actions dependency updates
- Security policy with GitHub private vulnerability reporting

### Changed

- Bump `actions/checkout` from 4 to 6
- Bump `actions/upload-artifact` from 4 to 7
- Bump `github/codeql-action` from 3 to 4
- Bump `@types/node` from 22.19.13 to 25.3.2
- Bump `esbuild` from 0.25.12 to 0.27.3
- Bump `eslint` from 9.39.3 to 10.0.2
- Bump `mocha` from 10.8.2 to 11.7.5

### Security

- Harden extension ID validation and reduce information leakage

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
