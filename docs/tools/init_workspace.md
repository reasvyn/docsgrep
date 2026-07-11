# `init_workspace`

Sets up a **docsgrep** base camp to store temporary files, logs, and reports.

## Description

`init_workspace` initializes the workspace required for all other docsgrep tools. It handles environment-specific setup with a robust fallback mechanism:

### Workspace Location
1. **Primary Location:** Tries to use the system's temporary directory (`/tmp/docsgrep/{projectName}`).
2. **Fallback:** If system temp is unavailable or permissions are denied, it creates a `.docsgrep/` folder directly within the project root.

### Automatic Git Management
The tool automatically detects if the project is a git repository. If so, it ensures that the `.gitignore` file includes the `.docsgrep/` directory, preventing transient analysis data and logs from being committed to version control.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `projectPath` | `string` | Yes | The absolute path to the local project root. |

## Example

```json
{
  "name": "init_workspace",
  "arguments": {
    "projectPath": "/home/user/projects/my-awesome-app"
  }
}
```

## Response

Returns the absolute path to the initialized workspace and confirms whether the `.gitignore` was updated.
