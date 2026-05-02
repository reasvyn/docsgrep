# `purge_cache` 🧹

Purges old cached repositories from the docsgrep workspace.

## Description

To manage disk space, `purge_cache` removes cloned repositories that haven't been accessed for a certain period (default: 7 days). It helps keep the `setup_camp` environment clean and efficient.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `localProjectPath` | `string` | Yes | The absolute path to the local project containing the `.docsgrep` workspace. |
| `maxAgeDays` | `number` | No | Maximum age in days for cached repos (default: 7). |

## Example

```json
{
  "name": "purge_cache",
  "arguments": {
    "localProjectPath": "/home/user/projects/my-app",
    "maxAgeDays": 14
  }
}
```

## Response

Confirms the number of repositories removed and the amount of space cleared.
