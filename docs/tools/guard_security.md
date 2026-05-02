# `guard_security` 🛡️

Performs an enterprise-grade security audit covering OWASP Top 10, secrets detection, and privacy compliance.

## Description

`guard_security` provides a multi-layered security analysis of the project. It uses specialized analyzers for different types of vulnerabilities:

### 1. OWASP Top 10 (2021) Mapping
The tool maps detected patterns to standard OWASP categories:
- **A01: Broken Access Control:** Insecure direct object references, role-based access flaws.
- **A02: Cryptographic Failures:** Weak hashing (MD5/SHA1), insecure random numbers, plaintext passwords.
- **A03: Injection:** SQL injection, `eval()` usage, XSS (innerHTML), command injection (`exec`/`spawn`).
- **A05: Security Misconfiguration:** Debug mode enabled, CORS wildcards (`*`).
- **A07: Authentication Failures:** Hardcoded passwords, weak login logic.
- **A10: SSRF:** Unvalidated URL fetching from user input.

### 2. Secrets Detection
Identifies hardcoded credentials using entropy and pattern matching:
- **Critical:** AWS Access/Secret Keys, GitHub Tokens, Google API Keys, Private Keys.
- **High:** Slack Tokens, Generic API Keys, Passwords in code.

### 3. Privacy & Compliance (GDPR/CCPA)
- **PII Detection:** Scans for Emails, Phone Numbers, Credit Cards, SSNs, and IP Addresses.
- **Logging Risks:** Detects if PII is being passed to logging functions (`console.log`, `logger.info`).
- **Client-Side Exposure:** Flags PII found in frontend/public directories.

### 4. Dependency Security
- **Lock File Check:** Verifies presence of `package-lock.json`, `yarn.lock`, etc.
- **Vulnerability Scan:** Basic check for floating versions (`*`, `latest`) and known vulnerable patterns.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `dirPath` | `string` | Yes | The absolute path to the local directory to audit. |
| `includePath` | `string[]` | No | Glob patterns to limit the audit scope (e.g., `['src/**/*.tsx']`). Overrides `filePatterns`. |
| `excludePath` | `string[]` | No | Glob patterns to exclude from scanning. Merged with project `.gitignore`. |
| `filePatterns` | `string[]` | No | (Legacy) Alias for `includePath`. |

## Example

```json
{
  "name": "guard_security",
  "arguments": {
    "dirPath": "/home/user/projects/my-app"
  }
}
```

## Response

Returns a `SecurityAuditReport` including:
- **Security Score (0-100):** A weighted score based on issue severity.
- **Risk Level:** Info, Low, Medium, High, or Critical.
- **Detailed Findings:** Each issue includes evidence, impact analysis, and remediation steps.
- **Compliance Status:** Basic mapping to **ISO/IEC 27001:2022** controls.
