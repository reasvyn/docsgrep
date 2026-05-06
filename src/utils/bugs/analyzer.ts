/**
 * Bug detection engine
 */
import { CodeSanitizer } from "../code-analysis.js";
import { 
  RUNTIME_PATTERNS, 
  RACE_PATTERNS, 
  MEMORY_PATTERNS, 
  PERFORMANCE_PATTERNS, 
  UNRESOLVED_PATTERNS 
} from "./patterns.js";

export class BugAnalyzer {
  static analyze(content: string, filePath: string): any[] {
    const issues = [];
    const ext = filePath.split('.').pop()?.toLowerCase() || 'ts';
    const lines = content.split('\n');
    const sanitized = CodeSanitizer.stripStrings(CodeSanitizer.stripComments(content, ext));
    
    issues.push(...this.check(sanitized, lines, filePath, RUNTIME_PATTERNS, 'Runtime'));
    issues.push(...this.check(sanitized, lines, filePath, RACE_PATTERNS, 'Race Condition'));
    issues.push(...this.check(sanitized, lines, filePath, MEMORY_PATTERNS, 'Memory Leak'));
    issues.push(...this.check(sanitized, lines, filePath, PERFORMANCE_PATTERNS, 'Performance'));
    issues.push(...this.check(content, lines, filePath, UNRESOLVED_PATTERNS, 'Unresolved'));

    return issues.slice(0, 20);
  }

  private static check(san: string, orig: string[], file: string, group: any, cat: string): any[] {
    const issues: any[] = [];
    for (const [title, config] of Object.entries(group) as any) {
      for (const pattern of config.patterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(san)) !== null) {
          const lineNum = san.substring(0, match.index).split('\n').length;
          if (CodeSanitizer.isIgnored(orig[lineNum - 1])) continue;
          
          issues.push({
            file, line: lineNum, category: cat, title,
            severity: this.getSev(cat),
            description: config.description,
            evidence: orig[lineNum - 1]?.trim().substring(0, 100),
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
