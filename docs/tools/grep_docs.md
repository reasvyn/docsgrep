# `grep_docs` 🔎

Searches for regex patterns within documentation files with relevance ranking and surrounding context.

## Description

`grep_docs` performs a targeted search within identified documentation files (READMEs and `docs/*.md`). Unlike standard `grep`, it ranks results based on a **relevance score** and provides optional **surrounding context lines** to help you understand the match without reading the full file.

### Relevance Scoring System
Results are ranked based on three weighted factors:
1. **Line Type Score:** Higher priority is given to matches in headers (`#`, `##`) or list items compared to standard paragraphs.
2. **File Importance Score:** Matches in root-level `README.md` or `ARCHITECTURE.md` are prioritized over deeply nested documentation.
3. **Match Precision Score:** Exact case-insensitive matches score higher than fuzzy or partial matches.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | The absolute path to the local directory to search. |
| `pattern` | `string` | Yes | The regex pattern to search for. |
| `filePattern` | `string` | No | Optional regex to filter which documentation files are searched. |
| `contextLines` | `number` | No | Optional. Number of surrounding context lines to include (max 5). |

## Example

```json
{
  "name": "grep_docs",
  "arguments": {
    "dirPath": "/home/user/projects/my-app",
    "pattern": "Authentication",
    "contextLines": 2
  }
}
```

## Response

Returns an array of results, each containing:
- `file`: Path to the matching file.
- `line`: Line number of the match.
- `content`: The matching text.
- `context`: (Optional) Array of surrounding lines if `contextLines` was provided.
- `relevanceScore`: A calculated numeric score used for ranking.
