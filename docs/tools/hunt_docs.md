# `hunt_docs` 🔍

Hunts for README files and documentation folders within a local directory.

## Description

`hunt_docs` is used to discover the available documentation for a project. It recursively searches for files matching `README*` patterns and explores standard documentation directories like `docs/`. It provides a quick way to find where the knowledge is stored in a codebase.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | The absolute path to the local directory to explore. |

## Example

```json
{
  "name": "hunt_docs",
  "arguments": {
    "dirPath": "/home/user/projects/my-awesome-app"
  }
}
```

## Response

Returns a list of file paths to found documentation and README files.
