# `read_file`

Peeks into the contents of a specific documentation or README file.

## Description

`read_file` reads the content of a file, providing essential safeguards for AI environments. It automatically detects binary files (and refuses to read them) and truncates output for very large files (>500KB) to prevent context window overflow while still providing the most relevant information.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `filePath` | `string` | Yes | The absolute path to the file to read. |

## Example

```json
{
  "name": "read_file",
  "arguments": {
    "filePath": "/home/user/projects/my-app/README.md"
  }
}
```

## Response

Returns the text content of the file.
