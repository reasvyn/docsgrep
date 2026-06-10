# `detect_patterns`

Maps project architectural patterns and suggests refactoring candidates for better abstraction.

## Description

`detect_patterns` is an architectural advisor tool that analyzes the "backbone" of your project. It identifies repeated structural patterns across multiple files and suggests when to extract logic into a **Base Class**, **Trait**, or **Interface**.

### Key Features
- **Zone Analysis**: Groups files by directory to infer the primary pattern of each module (e.g., Layered, Data-Centric, Service-Oriented).
- **Role Tagging**: Automatically identifies the role of each component based on naming suffixes and internal structure (Entry Point, Logic Holder, Data Access, etc.).
- **Similarity Matrix**: Compares method signatures across similar components to find redundancy.
- **Hybrid Support**: Understands that different parts of a project might use different patterns.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | The absolute path to the project directory. |
| `minSimilarity` | `number` | No | Minimum similarity score (0-1) to suggest abstraction. Default: 0.8 |
| `focus` | `string` | No | Optional focus: `interface`, `base_class`, `trait`, or `all`. |
| `excludePath` | `string[]` | No | Optional glob patterns to exclude from scanning. |

## Example

```bash
# Run via CLI
docsgrep run detect_patterns --dirPath ./src --minSimilarity 0.7
```

## Response

Returns an `ArchetypeReport` containing:
- `zones`: Map of directories and their detected architectural patterns.
- `suggestions`: Specific advice on where to apply refactoring/abstraction.
