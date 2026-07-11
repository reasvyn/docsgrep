# Contributing to docsgrep

Thank you for contributing to **docsgrep** -- a developer tool for documentation search, code quality auditing, security scanning, and bug detection.

## Standards & Conventions

We maintain high engineering standards to ensure reliability for both CLI users and AI agent integrations.

### 1. Strict TypeScript & ESM

- **Strict Typing**: No `any` unless absolutely unavoidable (and documented). Use the interfaces in `src/types/tools.ts`.
- **Node.js ESM**: We use `"type": "module"`. All imports **must** include the `.js` extension (e.g., `import { x } from "./utils.js"`).
- **Zod Schemas**: Tool inputs are validated via Zod in `src/index.ts`.

### 2. Testing Mandate

- **No Unverified Logic**: Every new feature or bug fix **must** include tests.
- **Coverage**: Maintain or improve the current test coverage. Run `bun run test:coverage` to check.
- **Mocking**: Use Vitest's `vi.mock` for file system or network operations.

### 3. Developer-Friendly Documentation

- If you change a tool's behavior, update:
    1. The markdown file in `docs/tools/`.
    2. The `README.md` (if it's a major change).
     3. The internal help map in `src/tools/help-info.ts`.

## Getting Started

1. **Setup**: `pnpm install`
2. **Develop**: Logic is modularized in `src/tools/` and `src/utils/`.
3. **Validate**: `pnpm test`
4. **Submit**: Open a PR with a clear description of the *intent* and *impact*.

## Contact

Questions or ideas? Reach out to **reasvyn@gmail.com**.
