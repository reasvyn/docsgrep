# `check_stale`

Identifies stale or out-of-sync documentation.

## Description

`check_stale` helps maintain documentation health by flagging:
1. **Old Docs:** Files that haven't been updated for a long time (default: 30 days).
2. **Out-of-Sync Docs:** Uses code analysis to detect if the documentation's claims (like method signatures or parameters) no longer match the actual implementation in the codebase.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | The absolute path to the local directory to check. |
| `maxAgeDays` | `number` | No | Maximum age in days before considered stale (default: 30). |
| `compareWithCode` | `boolean` | No | Also check if docs match current code (default: true). |

## Example

```json
{
  "name": "check_stale",
  "arguments": {
    "dirPath": "/home/user/projects/my-app",
    "compareWithCode": true
  }
}
```

## Response

Returns a report of stale documentation files with reasons and suggested actions.
