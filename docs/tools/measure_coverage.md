# Tool: measure_coverage

Measures documentation coverage (docblocks) across the codebase. Language-agnostic support for JS, TS, PHP, Python, Go, Rust, etc.

## Description

The `measure_coverage` tool scans source files to identify "documentable items" such as functions, classes, methods, and interfaces. It then checks if these items are preceded by a documentation block (e.g., JSDoc `/** ... */`, Rust `///`, Go `//`, or Python docstrings `""" ... """`).

This provides a metric similar to test coverage, helping teams maintain a high standard of code documentation.

## Arguments

- `dirPath` (string, **required**): The absolute path to the source directory.
- `includePath` (string[], optional): Glob patterns to limit the audit scope. Overrides `filePatterns`.
- `excludePath` (string[], optional): Glob patterns to exclude from scanning. Merged with project `.gitignore`.
- `filePatterns` (string[], optional): (Legacy) Alias for `includePath`.
- `publicOnly` (boolean, optional): Only count public/exported APIs. Defaults to `true`.

## Example Usage

### Python (checking docstrings)
```javascript
measure_coverage(dirPath: "/path/to/python/project", filePatterns: ["**/*.py"])
```

### TypeScript (public only)
```javascript
measure_coverage(dirPath: "/path/to/ts/project", publicOnly: true)
```

## Response

Returns a JSON object with a summary and a list of undocumented items:

```json
{
  "message": "Documentation coverage: 75.00% (75/100 items documented).",
  "summary": {
    "totalItems": 100,
    "documentedItems": 75,
    "undocumentedItems": 25,
    "coveragePercentage": 75.0
  },
  "undocumentedList": [
    {
      "file": "src/utils.ts",
      "line": 12,
      "item": "calculateHash",
      "type": "function"
    }
  ]
}
```
