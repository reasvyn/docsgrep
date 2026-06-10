# `sync_documentation` 🔄

Updates documentation based on code changes.

## Description

`sync_documentation` streamlines documentation maintenance by automatically detecting changes in method signatures, new functions, or updated classes. It can either update existing documentation or generate stubs for newly created code, ensuring that the documentation evolves alongside the product.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | The absolute path to the local project. |
| `filePaths` | `string[]` | No | Specific files that changed. If omitted, uses git diff to auto-detect. |
| `updateMode` | `string` | No | `create`, `update`, or `both` (default: `update`). |

## Example

```json
{
  "name": "sync_documentation",
  "arguments": {
    "dirPath": "/home/user/projects/my-app",
    "updateMode": "both"
  }
}
```

## Response

Confirms the files updated and provides a summary of the generated or modified documentation sections.
