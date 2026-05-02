# `ask_lint` ❓

Generates an interactive prompt for code linting options.

## Description

`ask_lint` is a helper tool that analyzes the project and provides the user (or AI agent) with a set of tailored options for performing an audit. It's useful when you're not sure which `focusAreas` to choose in `lint_code`.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | The absolute path to the local directory. |

## Example

```json
{
  "name": "ask_lint",
  "arguments": {
    "dirPath": "/home/user/projects/my-app"
  }
}
```

## Response

Returns a prompt string with recommended linting configurations based on the detected tech stack.
