# `ask_guard` ❓

Generates an interactive prompt for security audit options.

## Description

Similar to `ask_lint`, `ask_guard` provides a high-level overview of what `guard_security` will scan and offers several audit modes (e.g., "Full Audit", "Secrets Only", "Privacy Only") to help the user decide on the best approach.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | The absolute path to the local directory. |

## Example

```json
{
  "name": "ask_guard",
  "arguments": {
    "dirPath": "/home/user/projects/my-app"
  }
}
```

## Response

Returns a summary of the security audit scope and a list of available focus options.
