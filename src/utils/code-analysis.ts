/**
 * Utilities for code analysis and sanitization to reduce false positives
 */

export class CodeSanitizer {
  /**
   * Replaces comments with spaces of the same length to preserve line/char offsets.
   * Supports most common programming languages (C-style, Python, Ruby, Shell, etc.)
   */
  static stripComments(content: string, ext: string = 'ts'): string {
    let sanitized = content;
    
    // C-style comments (JS, TS, Java, C++, PHP, Go, Rust, etc.)
    if (['js', 'ts', 'jsx', 'tsx', 'php', 'go', 'rs', 'java', 'cpp', 'c', 'cs', 'swift', 'dart'].includes(ext)) {
      // Multi-line comments: /* ... */
      sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, (match) => ' '.repeat(match.length));
      // Single-line comments: // ...
      sanitized = sanitized.replace(/\/\/.*/g, (match) => ' '.repeat(match.length));
    }
    
    // Hash-style comments (Python, Ruby, Shell, Perl, Yaml, etc.)
    if (['py', 'rb', 'sh', 'bash', 'yaml', 'yml', 'pl', 'r'].includes(ext)) {
      // Single-line comments: # ...
      sanitized = sanitized.replace(/#.*/g, (match) => ' '.repeat(match.length));
      // Python multi-line strings (often used as comments)
      if (ext === 'py') {
        sanitized = sanitized.replace(/"""[\s\S]*?"""/g, (match) => ' '.repeat(match.length));
        sanitized = sanitized.replace(/'''[\s\S]*?'''/g, (match) => ' '.repeat(match.length));
      }
    }
    
    return sanitized;
  }

  /**
   * Replaces string literals with spaces of the same length to preserve offsets.
   */
  static stripStrings(content: string): string {
    // Matches "", '', and `` (backticks)
    // Handles escaped quotes: \" or \'
    return content.replace(/(["'`])(?:(?=(\\?))\2[\s\S])*?\1/g, (match) => ' '.repeat(match.length));
  }

  /**
   * Checks if a specific line should be ignored by the analyzer.
   * Looks for comments like "// docsgrep-ignore" or "# docsgrep-ignore"
   */
  static isIgnored(line: string): boolean {
    return /docsgrep-ignore|nolint|noscan|ignore-issue/i.test(line);
  }
}
