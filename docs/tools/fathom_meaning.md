# `fathom_meaning` 🧠

Performs semantic search across documentation.

## Description

Unlike `grep_docs`, which uses regex keyword matching, `fathom_meaning` understands natural language. It allows users to ask questions like "How do I handle authentication?" and finds relevant documentation even if the specific words don't match exactly.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | The absolute path to the local directory to search. |
| `query` | `string` | Yes | Natural language query about what you're looking for. |
| `topK` | `number` | No | Number of top results to return (default: 5). |

## Example

```json
{
  "name": "fathom_meaning",
  "arguments": {
    "dirPath": "/home/user/projects/my-app",
    "query": "process for deploying to production"
  }
}
```

## Response

Returns an array of relevant documentation snippets ranked by similarity to the query.
