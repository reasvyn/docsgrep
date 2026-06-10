# `check_style` 🐕

Sniffs out project style: explicit conventions, linter configurations, and implicit coding patterns.

## Description

`check_style` provides a comprehensive view of how code is written and organized in a project. It performs two main tasks:

### 1. Explicit Convention Detection
It scans the repository for known configuration and documentation files, including:
- **Linter Configs:** `.eslintrc`, `prettier.config.js`, `biome.json`, `phpcs.xml`, `golangci.yml`, `tox.ini`, `.flake8`, `.rubocop.yml`, `rustfmt.toml`.
- **Project Guidelines:** `CONTRIBUTING.md`, `ARCHITECTURE.md`, `STYLEGUIDE.md`.
- **Editor Config:** `.editorconfig`.

### 2. Implicit Pattern Analysis
It samples up to **3 random source files** (from `src/`, `app/`, `lib/`, etc.) to infer the following metrics:
- **Naming Conventions:** camelCase, snake_case, PascalCase, or UPPER_SNAKE.
- **Indentation:** Spaces vs. Tabs detection.
- **Quote Style:** Single, double, or backticks.
- **Complexity Metrics:** Average line length and comment density.
- **Comment Style:** Single-line vs. multi-line preference.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | The absolute path to the local directory to analyze. |
| `excludePath` | `string[]` | No | Optional glob patterns to exclude from scanning. |

## Example

```json
{
  "name": "check_style",
  "arguments": {
    "dirPath": "/home/user/projects/my-awesome-app"
  }
}
```

## Response

Returns a `ProjectStyleReport` containing:
- `conventions`: List of found configuration files and their content.
- `patterns`: Inferred codebase style based on sampled files.
- `recommendations`: Actionable advice to improve consistency.
