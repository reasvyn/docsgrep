# `summarize_doc`

Summarizes documentation files into concise chunks.

## Description

`summarize_doc` is designed to provide the essence of a documentation file without the noise. It's particularly useful for quickly understanding large READMEs or technical specifications when operating within a limited context window.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `filePath` | `string` | Yes | The absolute path to the documentation file to summarize. |
| `maxLength` | `number` | No | Maximum summary length in characters (default: 500). |

## Example

```json
{
  "name": "summarize_doc",
  "arguments": {
    "filePath": "/home/user/projects/my-app/docs/architecture.md"
  }
}
```

## Response

Returns a summarized version of the document.
