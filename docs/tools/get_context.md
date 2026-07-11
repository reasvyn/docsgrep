# `get_context`

Provides relevant documentation context based on the current file and its dependencies.

## Description

`get_context` is a proactive tool designed for AI agents. By providing the file currently being worked on, it automatically finds and returns the most relevant documentation snippets needed to understand the context of that specific code. It uses both **structural proximity** and **import-based analysis** to determine relevance.

### Intelligence Engine
- **Import Analysis:** The tool parses the current file for local `import` statements. If a documentation file matches the name of an imported module, its relevance is boosted to `high`.
- **Structural Proximity:** Documentation files in the same directory, parent directory, or main `docs/` folder are prioritized.
- **README Priority:** Root-level README files are always considered high-relevance entry points.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | The absolute path to the local project. |
| `currentFilePath` | `string` | Yes | The path to the file currently being worked on. |
| `contextDepth` | `string` | No | `minimal`, `standard`, or `deep` (default: `standard`). |

## Example

```json
{
  "name": "get_context",
  "arguments": {
    "dirPath": "/home/user/projects/my-app",
    "currentFilePath": "src/auth/jwt-strategy.ts"
  }
}
```

## Response

Returns a curated set of documentation excerpts, including:
- `file`: Path to the relevant documentation.
- `relevance`: `high`, `medium`, or `low`.
- `reason`: Why the tool considered this document relevant (e.g., "Related to an imported module").
