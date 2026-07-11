---
name: doc-writing
description: Write or update JSDoc/TSDoc, tool documentation in docs/, and root-level markdown for docsgrep
---

## Before writing docs

1. Read `AGENTS.md` for the documentation update checklist.
2. Read an existing tool doc in `docs/tools/` as a template.

## Three documentation layers

| Layer | Location | Audience |
|---|---|---|
| **Inline code docs** | JSDoc/TSDoc in `src/**/*.ts` | Developers reading source |
| **Tool reference** | `docs/tools/<tool_name>.md`, `docs/README.md` | CLI/MCP users |
| **Project-level** | Root `README.md`, `CONTRIBUTING.md` | Contributors, newcomers |

## Files to update when changing a tool

| What changed | Files to update |
|---|---|
| Tool behavior or args | `docs/tools/<tool_name>.md` + JSDoc on exported function |
| Tool name or description | `src/config/tools.json` |
| New tool added | `docs/tools/<tool_name>.md`, `docs/README.md`, `src/tools/help-info.ts` |
| New public function/class | JSDoc on that export in source |
| Major architectural change | `README.md` |

## JSDoc/TSDoc conventions

- Every exported function and class gets a JSDoc block.
- Document `@param`, `@returns`, and any side effects (FS writes, network, process spawn).
- Use `{@link}` to cross-reference related tools or types.

```typescript
/**
 * Scans the target directory for documentation files.
 *
 * @param args.dirPath - Root directory to scan from.
 * @param args.includePath - Optional glob patterns to include.
 * @returns List of discovered documentation file paths.
 */
export async function handleFindDocs(args: FindDocsArgs): Promise<McpToolResponse> {
```

## Per-tool doc template

Create `docs/tools/<tool_name>.md`:

````markdown
# `<tool_name>`

One-line tagline.

## Description

Detailed description paragraph(s).

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | Target directory path |
| `includePath` | `string[]` | No | Glob patterns to include |

## Example

```json
{
  "name": "<tool_name>",
  "arguments": { "dirPath": "." }
}
```

## Response

Description of the response shape. Include example JSON if complex.
````

## docs/README.md index format

Tools are grouped into five categories. Add new entries matching the existing format:

```markdown
| [`<tool_name>`](tools/<tool_name>.md) | Short description. |
```

## Internal help

`src/tools/help-info.ts` reads `docs/tools/*.md` at runtime. Ensure the filename matches the tool name exactly.

## Root markdown style

- Keep `README.md` focused on installation, quickstart, and tool overview — move details into `docs/`.
- `CONTRIBUTING.md` covers setup, conventions, and PR expectations — keep it under 50 lines.
- Both files use present tense, second-person voice ("you").
