/**
 * Utilities for code analysis and sanitization to reduce false positives.
 * Language-agnostic support for comments and string literals.
 */

export class CodeSanitizer {
  /**
   * Replaces comments with spaces of the same length to preserve line/char offsets.
   * Supports a wide variety of programming languages.
   */
  static stripComments(content: string, ext: string = 'ts'): string {
    let sanitized = content;
    const lang = ext.toLowerCase();
    
    // C-Style: // and /* */
    // Used by: JS, TS, Java, C, C++, C#, PHP, Go, Rust, Swift, Dart, Kotlin, Scala, Groovy, etc.
    const cStyleExtensions = [
      'js', 'ts', 'jsx', 'tsx', 'php', 'go', 'rs', 'java', 'cpp', 'c', 'cs', 
      'swift', 'dart', 'kt', 'kts', 'scala', 'groovy', 'gradle'
    ];
    
    if (cStyleExtensions.includes(lang)) {
      sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
      sanitized = sanitized.replace(/\/\/.*/g, (m) => ' '.repeat(m.length));
      return sanitized;
    }
    
    // Hash-Style: #
    // Used by: Python, Ruby, Shell, Perl, YAML, Elixir, R, PowerShell, etc.
    const hashStyleExtensions = [
      'py', 'rb', 'sh', 'bash', 'yaml', 'yml', 'pl', 'r', 'ex', 'exs', 'ps1'
    ];
    
    if (hashStyleExtensions.includes(lang)) {
      sanitized = sanitized.replace(/#.*/g, (m) => ' '.repeat(m.length));
      // Python/Ruby multi-line strings used as comments
      if (['py', 'rb'].includes(lang)) {
        sanitized = sanitized.replace(/"""[\s\S]*?"""/g, (m) => ' '.repeat(m.length));
        sanitized = sanitized.replace(/'''[\s\S]*?'''/g, (m) => ' '.repeat(m.length));
      }
      return sanitized;
    }

    // Dash-Style: --
    // Used by: SQL, Lua, Ada, Haskell, etc.
    if (['sql', 'lua', 'ada', 'hs'].includes(lang)) {
      sanitized = sanitized.replace(/--.*/g, (m) => ' '.repeat(m.length));
      return sanitized;
    }

    // Percent/Semicolon Style: % or ;
    // Used by: Erlang (%), Clojure/Lisp/Scheme (;)
    if (['erl', 'hrl', 'clj', 'cljs', 'lisp', 'scm'].includes(lang)) {
      sanitized = sanitized.replace(/[%|;].*/g, (m) => ' '.repeat(m.length));
      return sanitized;
    }
    
    // Generic fallback for unknown languages: try common patterns
    sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
    sanitized = sanitized.replace(/(?:\/\/|#|--|;|%).*/g, (m) => ' '.repeat(m.length));

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
    if (!line) return false;
    return /docsgrep-ignore|nolint|noscan|ignore-issue/i.test(line);
  }
}
