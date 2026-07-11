---
name: test-writing
description: Write unit and integration tests for docsgrep tool handlers and utilities
---

## Before writing tests

1. Read `AGENTS.md` for test commands and conventions.
2. Find an existing test file for a similar handler and copy its structure.

## Run tests

```bash
bun run test                          # all tests
bun run vitest run tests/path/to.test.ts  # single file
```

## Unit test pattern

Place in `tests/unit/`. Mock all external IO at module level:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleMyTool } from "../../../src/tools/my-tool.js";

vi.mock("node:fs/promises");
vi.mock("glob");

beforeEach(() => vi.resetAllMocks());

describe("handleMyTool", () => {
  it("returns results", async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
    vi.mocked(glob).mockResolvedValue(["docs/readme.md"] as any);

    const result = await handleMyTool({ dirPath: "/test" });
    const data = JSON.parse(result.content[0].text);

    expect(data).toHaveProperty("files");
    expect(result.isError).toBeUndefined();
  });

  it("returns error for invalid path", async () => {
    const result = await handleMyTool({ dirPath: "" });
    expect(result.isError).toBe(true);
  });
});
```

### Key rules

- **Mock at module level**: `vi.mock('node:fs/promises')`, `vi.mock('glob')`, `vi.mock('simple-git')`, etc.
- **Reset between tests**: `beforeEach(() => vi.resetAllMocks())`.
- **Parse responses**: always `JSON.parse(result.content[0].text)` before asserting on data.
- **Mock shapes**: match real return types (e.g., `fs.stat` needs `{ isDirectory: () => true }`).
- **Conditional mocks**: use `mockImplementation` to return different values per input.

## Integration test pattern

Place in `tests/integration/`. Spawns the real MCP server over stdio:

```typescript
import { Client } from "@modelcontextprotocol/sdk";
import { StdioClientTransport } from "@modelcontextprotocol/sdk";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, "..", "..", "src", "index.ts");

let transport: StdioClientTransport;
let client: Client;

beforeAll(async () => {
  transport = new StdioClientTransport({ command: "npx", args: ["tsx", serverPath] });
  client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
}, 30000);

afterAll(async () => { await client.close(); });
```

### Key rules

- **30s timeout** on `beforeAll` — server startup is slow.
- **Full round-trip**: call `client.callTool({ name, arguments })` and assert on `result`.
- **Test project setup**: create temp files in `beforeAll`, clean up in `afterAll`.
