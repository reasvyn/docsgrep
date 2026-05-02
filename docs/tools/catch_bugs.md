# `catch_bugs` 🐛

Detects runtime bugs, race conditions, and potential failures in code across multiple categories.

## Description

`catch_bugs` is a professional-grade bug detection tool that uses pattern matching to identify risky code structures. It categorizes findings into 6 major areas:

### 1. Runtime Errors (Critical)
- **Unhandled Promise Rejections:** Promises or `await` operations without proper `.catch()` or `try-catch` blocks.
- **Null/Undefined Dereference:** Accessing properties on variables without safety checks or optional chaining.
- **Uninitialized Variables:** Use of variables declared but not yet assigned a value.
- **Type Coercion Issues:** Use of loose equality (`==`) which may lead to unexpected behavior.

### 2. Race Conditions (Critical)
- **Unsynchronized Shared State:** Concurrent modifications to global or shared variables.
- **Missing Async/Await:** Mixing `async/await` with raw `.then()` patterns in the same scope.
- **Concurrent Modification:** Modifying arrays or objects while iterating over them.

### 3. Memory Leaks (High)
- **Event Listener Leaks:** Adding listeners without corresponding removal logic.
- **Uncleared Intervals/Timers:** `setInterval` calls without a matching `clearInterval`.
- **Large Object References:** Unbounded caches or Maps that could grow indefinitely.

### 4. Dependency Coupling (Medium)
- **Circular Dependencies:** Mutual imports between modules.
- **Tight Coupling:** Excessive direct instantiation (`new Class()`) instead of dependency injection.
- **God Objects:** Modules exporting too many distinct functions or classes.

### 5. Performance (High)
- **Inefficient Loops:** Loop conditions that recalculate `.length` on every iteration.
- **Synchronous I/O:** Using `readFileSync` or other blocking operations in an async environment.
- **Memory-Heavy Ops:** Large `JSON.parse()` calls or deep chained array operations on large datasets.

### 6. Unresolved Issues (Medium)
- **Technical Debt:** `TODO`, `FIXME`, or `HACK` comments.
- **Debug Statements:** `console.log` or `debugger` statements left in production paths.
- **Deprecated APIs:** Usage of legacy functions like `Date.getYear()`.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | The absolute path to the local directory to analyze. |
| `filePatterns` | `string[]` | No | Glob patterns to limit the scan scope. |

## Example

```json
{
  "name": "catch_bugs",
  "arguments": {
    "dirPath": "/home/user/projects/my-app"
  }
}
```

## Response

Returns a `BugReport` containing:
- **Bug Score (0-100):** A health metric where higher is better.
- **Risk Level:** Critical, High, Medium, or Low.
- **Detailed Findings:** Each issue provides evidence, potential impact, and a specific remediation path.
