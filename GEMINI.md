# docsgrep Project Instructions

This document defines the foundational engineering mandates for the **docsgrep** codebase.

## 🛠️ Architecture & Runtime
- **Node.js ESM**: The project is a native ESM module. All local imports MUST include the `.js` extension.
- **Strict TypeScript**: 
    - No implicit `any`.
    - All tool arguments must use interfaces defined in `src/types/tools.ts`.
    - Handlers should return `Promise<McpToolResponse>`.
- **Modular Handlers**: Do not put complex logic in `src/index.ts`. Delegate to specialized modules in `src/tools/` or `src/utils/`.

## 🛡️ Security & Integrity
- **Path Resolution**: Always use `path.resolve()` and validate that paths are within allowed project boundaries when applicable.
- **Credential Protection**: NEVER log or store detected secrets or PII.
- **Concurrency**: Use the `operationLimiter` (semaphore) for all filesystem or network-intensive operations.

## 🧪 Testing Standards
- **Mocking**: Use `vi.mock` for all external IO.
- **E2E Integration**: Major tool workflows must have an integration test using the `StdioClientTransport`.
- **Coverage**: Maintain a statement coverage of at least 55% across the codebase.

## 📝 Documentation Workflow
1. Update `docs/tools/<tool_name>.md`.
2. Update `src/tools/help-info.ts` (internal help).
3. Update `README.md` for major architectural changes.

---
*Follow these rules to ensure the project remains high-quality and AI-agent friendly.*
