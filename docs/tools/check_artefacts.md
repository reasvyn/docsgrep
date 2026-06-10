# `check_artefacts` 🦴

Identifies documentation artifacts that need updates based on recent code changes.

## Description

`check_artefacts` uses git history to find documentation that has become "fossilized" - meaning the related code has changed significantly but the documentation hasn't been touched. It helps prioritize which docs need the most urgent attention after a series of commits.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | The absolute path to the local project. |
| `sinceCommit` | `string` | No | Commit hash to check changes since. Defaults to the last commit. |
| `priorityMode` | `string` | No | `impact` (based on amount of code change) or `recency` (default: `impact`). |

## Example

```json
{
  "name": "check_artefacts",
  "arguments": {
    "dirPath": "/home/user/projects/my-app",
    "sinceCommit": "a1b2c3d"
  }
}
```

## Response

Returns a prioritized list of documentation files that are likely out of date.
