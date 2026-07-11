# `check_delta`

Compares documented behavior against implementation reality.

## Description

`check_delta` provides a detailed diff between what a documentation file claims and what the code actually implements. It's similar to `verify_docs` but focuses on highlighting the specific implementation details (including code snippets) that have diverged from the documentation.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | The absolute path to the local project. |
| `docPath` | `string` | Yes | The path to the documentation file. |
| `includeCodeSnippets` | `boolean` | No | Whether to include actual code snippets in the diff (default: true). |

## Example

```json
{
  "name": "check_delta",
  "arguments": {
    "dirPath": "/home/user/projects/my-app",
    "docPath": "docs/api-reference.md"
  }
}
```

## Response

Returns a structured report of the "deltas" found, including implementation vs. documentation comparisons.
