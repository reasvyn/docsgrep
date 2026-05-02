# `spy_stack` 🕵️

Spies on the project's technology stack by reading and analyzing package manager configuration files.

## Description

`spy_stack` identifies the languages, frameworks, and tools being used in a project. It scans for common configuration files across a wide range of ecosystems:

### Supported Package Managers & Files
- **Node.js:** `package.json`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`.
- **Python:** `requirements.txt`, `pipfile`, `pyproject.toml`, `setup.py`.
- **Go:** `go.mod`, `go.sum`.
- **Rust:** `Cargo.toml`, `Cargo.lock`.
- **PHP:** `composer.json`, `composer.lock`.
- **Ruby:** `Gemfile`, `Gemfile.lock`.
- **Java/Kotlin:** `pom.xml`, `build.gradle`, `build.gradle.kts`.
- **C/C++:** `CMakeLists.txt`, `Makefile`.
- **C#/.NET:** `*.csproj`, `*.sln`.
- **Dart/Flutter:** `pubspec.yaml`.
- **Elixir:** `mix.exs`.
- **Swift:** `Package.swift`.

This information is used by other tools to provide context-aware analysis (e.g., choosing the right security patterns or linting rules).

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | The absolute path to the local directory to analyze. |

## Example

```json
{
  "name": "spy_stack",
  "arguments": {
    "dirPath": "/home/user/projects/my-awesome-app"
  }
}
```

## Response

Returns a structured report of detected technologies, versions (if available), and a list of identified package manager files.
