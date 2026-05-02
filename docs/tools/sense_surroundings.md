# `sense_surroundings` 🧭

Provides relevant documentation context based on the current file.

## Description

`sense_surroundings` is a proactive tool designed for AI agents. By providing the file currently being worked on, it automatically finds and returns the most relevant documentation snippets needed to understand the context of that specific code, without the agent having to search manually.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | The absolute path to the local project. |
| `currentFilePath` | `string` | Yes | The path to the file currently being worked on. |
| `contextDepth` | `string` | No | `minimal`, `standard`, or `deep` (default: `standard`). |

## Example

```json
{
  "name": "sense_surroundings",
  "arguments": {
    "dirPath": "/home/user/projects/my-app",
    "currentFilePath": "src/auth/jwt-strategy.ts"
  }
}
```

## Response

Returns a curated set of documentation excerpts relevant to the current file.
