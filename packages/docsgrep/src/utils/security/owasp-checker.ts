/**
 * OWASP Top 10 Security Checker
 */
import { CodeSanitizer } from "../code-analysis.js";
import { type SecurityIssue } from "./types.js";
import { OWASP_PATTERNS } from "./patterns.js";

export class OwaspChecker {
  static check(content: string, filePath: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const ext = filePath.split('.').pop()?.toLowerCase() || 'ts';
    
    // Skip self-checking
    if (this.shouldSkip(filePath)) return issues;
    
    const lines = content.split('\n');
    const sanitizedContent = CodeSanitizer.stripComments(content, ext);

    for (const [category, config] of Object.entries(OWASP_PATTERNS)) {
      if (config.patterns.length === 0) continue;

      for (const pattern of config.patterns) {
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(sanitizedContent)) !== null) {
          const lineNum = sanitizedContent.substring(0, match.index).split('\n').length;
          const originalLine = lines[lineNum - 1]?.trim() || '';
          
          if (CodeSanitizer.isIgnored(originalLine)) continue;

          issues.push({
            file: filePath,
            line: lineNum,
            severity: this.getSeverity(category),
            category: 'OWASP',
            owaspCategory: category,
            title: category,
            description: config.description,
            evidence: originalLine.substring(0, 100),
            impact: this.getImpact(category),
            remediation: this.getRemediation(category),
          });
        }
      }
    }

    return issues.slice(0, 10);
  }

  private static shouldSkip(path: string): boolean {
    const skips = ['security-audit', 'docsgrep', 'best-practices', 'node_modules'];
    return skips.some(s => path.includes(s));
  }

  private static getSeverity(category: string): SecurityIssue['severity'] {
    if (/A01|A03|A07/.test(category)) return 'critical';
    if (/A02|A05|A08/.test(category)) return 'high';
    return 'medium';
  }

  private static getImpact(category: string): string {
    const impacts: Record<string, string> = {
      'A01': 'Unauthorized access to sensitive data or functions',
      'A02': 'Data breaches, cryptographic failures',
      'A03': 'Data breach, data loss, system compromise',
      'A05': 'System compromise, exposure',
      'A07': 'Account takeover, identity theft',
    };
    const key = Object.keys(impacts).find(k => category.includes(k));
    return key ? impacts[key] : 'Security integrity risk';
  }

  private static getRemediation(category: string): string {
    const remediations: Record<string, string> = {
      'A01': 'Implement proper access controls, principle of least privilege',
      'A02': 'Use strong encryption (AES-256), secure key storage',
      'A03': 'Use parameterized queries, input validation',
      'A05': 'Disable debug, secure default configs',
    };
    const key = Object.keys(remediations).find(k => category.includes(k));
    return key ? remediations[key] : 'Follow security best practices';
  }
}
