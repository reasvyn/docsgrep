---
name: code-writing
description: Write or modify tool handlers, utilities, and core logic in the docsgrep codebase
---

## Before writing code

1. Read `AGENTS.md` for repo conventions.
2. Find an existing tool handler that does something similar and use it as a template.

## Tool handler pattern

Every tool must return `McpToolResponse`:

```typescript
import type { McpToolResponse } from "../types/tools.js";

export async function handleMyTool(args: MyToolArgs): Promise<McpToolResponse> {
  try {
    const dirPath = validateDirPath(validateStringParam(args.dirPath, "dirPath"));
    // ... do work ...
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) })];
  } catch (error: any) {
    return { content: [{ type: "text", text: error.message }], isError: true };
  }
}
```

### BaseTool (for heavier tools)

Extend `BaseTool<T>` from `tools/base.ts` when you need built-in concurrency control, logging, and credential masking. Then wrap in a thin function for the registry:

```typescript
class MyTool extends BaseTool<MyToolArgs> {
  protected async run(args: MyToolArgs): Promise<McpToolResponse> {
    // ... implementation ...
  }
}
export async function handleMyTool(args: MyToolArgs): Promise<McpToolResponse> {
  return new MyTool().execute(args);
}
```

### Registration

Add the handler to `ToolRegistry` in `tools/registry.ts`. For class-based tools, pass as an override in `index.ts`.

### Tool definitions

Add a JSON Schema entry to `src/config/tools.json` with `name`, `description`, and `inputSchema`.

## Mandatory conventions

- **ESM `.js` extensions**: every local import MUST end in `.js`.
- **No implicit `any`**: use typed args from `types/tools.ts`.
- **Input validation**: always call `validateDirPath` and `validateStringParam` at entry.
- **File scanning**: use `FileScanner.findFiles()` from `tools/base.ts` — it handles `.gitignore`, `includePath`, `excludePath`.
- **App metadata**: use `AppInfo` from `utils/app-info.ts`, never hardcode version/name.
- **Concurrency**: if doing IO, acquire/release `operationLimiter` from `utils/semaphore.js`.
- **Sensitive data**: add new secret fields to `maskSensitive` in `tools/base.ts`.
