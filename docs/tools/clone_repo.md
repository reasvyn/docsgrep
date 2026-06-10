# `clone_repo` 🚚

Fetches a remote git repository to a temporary directory and identifies its documentation.

## Description

`clone_repo` allows docsgrep to work with remote repositories. It clones the repository into the workspace managed by `init_workspace`. 

### Smart Caching & Performance
- **Shallow Cloning:** Uses `--depth 1` for all clones and fetches to minimize bandwidth and storage.
- **Deduplication:** Uses an **MD5 hash** of the repository URL and version (branch or tag) to create unique, persistent cache directories.
- **Fast Updates:** If a repository already exists in the cache, it performs a `git fetch` and `git reset --hard` instead of a full clone.

### Version & Tag Support
You can target specific versions of a repository using the `branch` or `tag` parameters.
- If both are provided, `tag` takes precedence.
- Tags are fetched accurately using `refs/tags/` to ensure the correct version is checked out.

### Authentication
- **HTTPS:** Automatically injects the `authToken` into the URL (e.g., `https://<token>@github.com/...`).
- **SSH:** Supports private key authentication via `ssh-i` and automatically handles host key checking.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `repoUrl` | `string` | Yes | The URL of the git repository (http, https, git, or ssh). |
| `branch` | `string` | No | Specific branch to explore. |
| `tag` | `string` | No | Specific tag or version to explore (e.g., `v1.0.0`). |
| `localProjectPath` | `string` | No | Path to a local project to use its existing `.docsgrep` workspace. |
| `authToken` | `string` | No | Auth token (e.g., GitHub PAT) for private HTTPS repos. |
| `sshKeyPath` | `string` | No | Path to an SSH private key for authentication. |

## Example

```json
{
  "name": "clone_repo",
  "arguments": {
    "repoUrl": "https://github.com/reasvyn/docsgrep.git",
    "branch": "main"
  }
}
```

## Response

Returns the local path where the repository was cloned and a list of identified documentation files.
