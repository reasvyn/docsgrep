# `lint_code` 🧼

Performs an enterprise-grade code quality audit (linting) across multiple languages.

## Description

`lint_code` uses a language-agnostic "Universal Code Analyzer" to detect quality issues that apply across all programming paradigms. It evaluates the project's health based on structure, documentation, and code patterns.

### Detected Code Smells
The tool identifies the following issues in up to **50 source files**:
- **Long Files/Functions:** Files >400 lines or functions >50 lines.
- **Deep Nesting:** Code nested more than 4 levels deep (indicates complexity).
- **Magic Numbers:** Literal numbers (excluding 0, 1, etc.) used directly in logic.
- **Duplicate Code:** Repeated logic blocks within a file.
- **Technical Debt:** Unresolved `TODO`, `FIXME`, `HACK`, or `BUG` comments.
- **Dead Code:** Potentially unused variables (currently optimized for JS/TS).
- **Long Lines:** Lines exceeding 120 characters.

### Project Scoring
The audit provides two key scores (0-100):
1. **Documentation Score:** Based on the presence of READMEs, linter configs, tests, and CI/CD pipelines.
2. **Code Quality Score:** Based on issue density (issues per file) across the sampled codebase.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | The absolute path to the local directory to audit. |
| `includePath` | `string[]` | No | Glob patterns to limit the audit scope (e.g., `['src/**/*.tsx']`). Overrides `filePatterns`. |
| `excludePath` | `string[]` | No | Glob patterns to exclude from scanning. Merged with project `.gitignore`. |
| `filePatterns` | `string[]` | No | (Legacy) Alias for `includePath`. |
| `focusAreas` | `string[]` | No | Focus areas: `dead_code`, `structure`, `performance`, `naming`, `all`. |

## Example

```json
{
  "name": "lint_code",
  "arguments": {
    "dirPath": "/home/user/projects/my-app",
    "focusAreas": ["dead_code", "structure"]
  }
}
```

## Response

Returns an `AuditReport` containing:
- **Summary:** Issue counts categorized by severity (Critical, High, Medium, Low).
- **Project Structure:** Verification of documentation, tests, and CI setup.
- **Strengths & Recommendations:** Tailored feedback on project health.
- **Issues List:** Detailed findings with file paths, line numbers, and suggestions.
