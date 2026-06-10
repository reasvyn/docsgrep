# `security_interactive` ❓

Generates an interactive prompt for security audit options.

## Description

Similar to `lint_interactive`, `security_interactive` provides a high-level overview of what `audit_security` will scan and offers several audit modes (e.g., "Full Audit", "Secrets Only", "Privacy Only") to help the user decide on the best approach.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | The absolute path to the local directory. |

## Example

```json
{
  "name": "security_interactive",
  "arguments": {
    "dirPath": "/home/user/projects/my-app"
  }
}
```

## Response

Returns a summary of the security audit scope and a list of available focus options.
