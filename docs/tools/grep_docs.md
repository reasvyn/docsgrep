# `grep_docs` 🔎

Searches for regex patterns within documentation files with relevance ranking.

## Description

`grep_docs` performs a targeted search within identified documentation files (READMEs and `docs/*.md`). Unlike standard `grep`, it ranks results based on a **relevance score** to help you find the most important information first.

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

## Example

```json
{
  "name": "grep_docs",
  "arguments": {
    "dirPath": "/home/user/projects/my-app",
    "pattern": "Authentication",
    "filePattern": "API.*"
  }
}
```

## Response

Returns an array of results, each containing:
- `file`: Path to the matching file.
- `line`: Line number of the match.
- `content`: The matching text.
- `relevanceScore`: A calculated numeric score used for ranking.
