# `show_help`

Provides comprehensive help and examples for all docsgrep tools.

## Description

`show_help` is an "in-app" documentation tool. It provides detailed descriptions, common usage patterns, and pro tips for all (or specific) tools available in docsgrep. It is essentially the machine-readable version of the Markdown documentation files in this directory.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `toolName` | `string` | No | Specific tool to get help for. If omitted, returns help for all tools. |

## Example

```json
{
  "name": "show_help",
  "arguments": {
    "toolName": "audit_security"
  }
}
```

## Response

Returns detailed help text and examples for the requested tool(s).
