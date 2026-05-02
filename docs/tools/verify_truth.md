# `verify_truth` ✅

Verifies consistency between code and documentation.

## Description

`verify_truth` acts as a linter for your documentation. it parses your Markdown files and compares them against the source code to ensure that every documented method, parameter, and return type is accurate. It helps prevent "documentation rot."

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | The absolute path to the local project. |
| `docPath` | `string` | Yes | The path to the documentation file to validate. |
| `strictMode` | `boolean` | No | If true, fails on warnings as well (default: false). |

## Example

```json
{
  "name": "verify_truth",
  "arguments": {
    "dirPath": "/home/user/projects/my-app",
    "docPath": "docs/api-reference.md"
  }
}
```

## Response

Returns a validation report listing discrepancies between the document and the actual codebase.
