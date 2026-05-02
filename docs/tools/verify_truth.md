# `verify_truth` ✅

Verifies consistency between code and documentation, including signature validation.

## Description

`verify_truth` acts as a linter for your documentation. It parses your Markdown files and compares them against the source code to ensure that every documented method and parameter is accurate. It helps prevent "documentation rot" by validating both existence and **function signatures**.

### Features
- **Existence Check:** Ensures that every function, class, or method described in the documentation actually exists in the codebase.
- **Signature Validation (Arity):** Compares the number of parameters (arity) between the documentation and the actual implementation. If a function is documented with 3 parameters but implemented with 2, it flags a `signature_mismatch`.

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

Returns a validation report listing:
- `item`: The name of the symbol being checked.
- `status`: `found`, `not_found`, or `signature_mismatch`.
- `suggestion`: Remediation advice (e.g., "Parameter count mismatch. Doc has 3, but code implementation differs").
