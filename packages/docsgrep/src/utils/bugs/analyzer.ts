import { CodeSanitizer } from "../code-analysis.js";
import { 
  RUNTIME_PATTERNS, 
  RACE_PATTERNS, 
  MEMORY_PATTERNS, 
  PERFORMANCE_PATTERNS, 
  UNRESOLVED_PATTERNS,
  isSafeCall,
} from "./patterns.js";

function isInsideTryCatch(lines: string[], lineNum: number): boolean {
  let braceDepth = 0;
  let inTry = false;
  const checkUpTo = Math.min(lineNum + 1, lines.length);
  for (let i = 0; i < checkUpTo; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('try ') || trimmed.startsWith('try{') || trimmed === 'try') {
      inTry = true;
    }
    if (inTry) {
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }
      if (braceDepth <= 0 && (trimmed === '}' || trimmed.endsWith('}'))) {
        inTry = false;
        braceDepth = 0;
      }
    }
  }
  return inTry;
}

function hasFinallyCleanup(content: string, matchIndex: number): boolean {
  const after = content.substring(matchIndex);
  const finallyMatch = after.match(/\.finally\s*\(/);
  if (!finallyMatch || typeof finallyMatch.index === 'undefined') return false;
  const snippet = after.substring(0, finallyMatch.index + finallyMatch[0].length + 200);
  return /\bclearTimeout\b|\bclearInterval\b/.test(snippet);
}

function isNullCheck(line: string): boolean {
  const trimmed = line.trim();
  return /\bnull\b/.test(trimmed) || /\bundefined\b/.test(trimmed);
}

export class BugAnalyzer {
  static analyze(content: string, filePath: string): any[] {
    const issues = [];
    const ext = filePath.split('.').pop()?.toLowerCase() || 'ts';
    const lines = content.split('\n');
    const sanitized = CodeSanitizer.stripStrings(CodeSanitizer.stripComments(content, ext));
    
    issues.push(...this.check(sanitized, content, lines, filePath, RUNTIME_PATTERNS, 'Runtime')); // docsgrep-ignore
    issues.push(...this.check(sanitized, content, lines, filePath, RACE_PATTERNS, 'Race Condition')); // docsgrep-ignore
    issues.push(...this.check(sanitized, content, lines, filePath, MEMORY_PATTERNS, 'Memory Leak')); // docsgrep-ignore
    issues.push(...this.check(sanitized, content, lines, filePath, PERFORMANCE_PATTERNS, 'Performance')); // docsgrep-ignore
    issues.push(...this.check(content, content, lines, filePath, UNRESOLVED_PATTERNS, 'Unresolved')); // docsgrep-ignore

    issues.push(...this.checkAwait(lines, filePath)); // docsgrep-ignore

    issues.push(...this.checkTypeCoercion(content, lines, filePath)); // docsgrep-ignore

    return issues.slice(0, 20);
  }

  private static checkAwait(lines: string[], file: string): any[] {
    const issues: any[] = [];
    const numLines = lines.length;
    for (let i = 0; i < numLines; i++) {
      const line = lines[i];
      if (/\bawait\b/.test(line) && !isInsideTryCatch(lines, i)) {
        if (CodeSanitizer.isIgnored(line, lines, i)) continue;
        issues.push({
          file, line: i + 1, category: 'Runtime', title: 'Unhandled Promise Rejection',
          severity: 'critical',
          description: 'Async operation without try-catch error handling',
          evidence: line.trim().substring(0, 100),
          impact: 'Uncaught rejection may crash the process.',
          remediation: 'Wrap await in a try-catch block.'
        });
      }
    }
    return issues;
  }

  private static checkTypeCoercion(raw: string, orig: string[], file: string): any[] {
    const issues: any[] = [];
    const lines = raw.split('\n');
    const numLines = lines.length;
    for (let i = 0; i < numLines; i++) {
      const line = lines[i];
      if (isNullCheck(line)) continue;
      const coerceMatch = line.match(/(?<![=!])==(?!=)|(?<!!)!=(?!=)/);
      if (coerceMatch && !CodeSanitizer.isIgnored(line, orig, i)) {
        issues.push({
          file, line: i + 1, category: 'Runtime', title: 'Type Coercion',
          severity: 'critical',
          description: 'Loose equality/inequality issues',
          evidence: orig[i]?.trim().substring(0, 100) || '',
          impact: 'Unexpected type coercion may hide bugs.',
          remediation: 'Use === or !== for strict comparison.'
        });
        if (issues.length >= 10) break;
      }
    }
    return issues;
  }

  private static check(
    san: string, raw: string, orig: string[], file: string, group: any, cat: string
  ): any[] {
    const issues: any[] = [];
    for (const [title, config] of Object.entries(group) as any) {
      for (const pattern of config.patterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(san)) !== null) {
          const lineNum = san.substring(0, match.index).split('\n').length;
          if (CodeSanitizer.isIgnored(orig[lineNum - 1], orig, lineNum - 1)) continue;
          
          if (title === 'Null Dereference') {
            if (isSafeCall(san, match.index)) continue;
            if (san[match.index - 1] === '.') continue;
          }

          if (title === 'Timer Leaks' && hasFinallyCleanup(raw, match.index)) continue;

          if (title === 'Type Coercion') {
            if (isNullCheck(orig[lineNum - 1] || '')) continue;
            const origLine = orig[lineNum - 1] || '';
            const matchInOrig = origLine.includes('===') || origLine.includes('!==');
            if (matchInOrig) continue;
          }

          issues.push({
            file, line: lineNum, category: cat, title,
            severity: this.getSev(cat),
            description: config.description,
            evidence: orig[lineNum - 1]?.trim().substring(0, 100) || '',
            impact: 'Potential runtime issue or debt.',
            remediation: 'Review code and apply fixes.'
          });
        }
      }
    }
    return issues;
  }

  private static getSev(cat: string): string {
    if (cat === 'Runtime' || cat === 'Race Condition') return 'critical';
    if (cat === 'Memory Leak' || cat === 'Performance') return 'high';
    return 'medium';
  }
}
