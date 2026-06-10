# docsgrep Project Instructions

This document defines the foundational engineering mandates for the **docsgrep** codebase.

## Architecture & Runtime

- **Node.js ESM**: The project is a native ESM module. All local imports MUST include the `.js` extension.
- **BaseTool Inheritance**: All tool handlers SHOULD inherit from the `BaseTool` class in `packages/docsgrep/src/tools/base.ts`. This ensures consistent logging, masking, and concurrency control.
- **SSoT Metadata**: Always use the `AppInfo` utility (`packages/docsgrep/src/utils/app-info.ts`) for application versioning, name, and description. Do NOT hardcode these values.
- **Strict TypeScript**: 
    - No implicit `any`.
    - All tool arguments must use interfaces defined in `packages/docsgrep/src/types/tools.ts`.
    - Use `McpToolResponse` for all tool outputs.
- **Modular Design**: Delegate logic to specialized modules in `packages/docsgrep/src/tools/` or `packages/docsgrep/src/utils/`. `packages/docsgrep/src/index.ts` should remain a thin entry point.

## Scanning & Path Filtering

- **FileScanner Utility**: Use `FileScanner.findFiles` for all filesystem scanning.
- **Universal Parameters**: All scanning tools MUST support `includePath` and `excludePath` glob patterns.
- **Gitignore Respect**: All scanning operations MUST respect the project's `.gitignore` rules by utilizing `getIgnorePatterns` from `packages/docsgrep/src/utils/file.ts`.

## Security & Integrity

- **Credential Protection**: `BaseTool` automatically masks `authToken`. Ensure any new sensitive parameters are added to `maskSensitive`.
- **Concurrency**: `BaseTool` automatically manages the `operationLimiter`. Use it for any new standalone async tasks.
- **Validation**: Rigorously validate all `dirPath` inputs using `validateDirPath`.

## Testing Standards

- **Mocking**: Use `vi.mock` for all external IO.
- **E2E Integration**: Major tool workflows must have an integration test using the `StdioClientTransport`.
- **Regression Guard**: Every fix for a `catch_bugs` finding should include a specific test case in `tests/`.

## Documentation Workflow

1. Update `docs/tools/<tool_name>.md`.
2. Update `packages/docsgrep/src/tools/help-info.ts` (internal help).
3. Update `README.md` for major architectural changes.

---

*Follow these rules to ensure docsgrep remains a robust and maintainable developer tool.*
