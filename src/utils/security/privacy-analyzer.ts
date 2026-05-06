/**
 * PII and Privacy Regulation Analyzer
 */
import { CodeSanitizer } from "../code-analysis.js";
import { type SecurityIssue } from "./types.js";
import { PII_PATTERNS } from "./patterns.js";

export class PrivacyAnalyzer {
  static analyze(content: string, filePath: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const lines = content.split('\n');
    const ext = filePath.split('.').pop()?.toLowerCase() || 'ts';
    const sanitizedContent = CodeSanitizer.stripComments(content, ext);

    for (const pii of PII_PATTERNS) {
      pii.pattern.lastIndex = 0;
      let match;
      
      while ((match = pii.pattern.exec(sanitizedContent)) !== null) {
        const lineNum = sanitizedContent.substring(0, match.index).split('\n').length;
        const originalLine = lines[lineNum - 1] || '';
        if (CodeSanitizer.isIgnored(originalLine)) continue;

        if (this.isLogging(originalLine)) {
          issues.push(this.createIssue(filePath, lineNum, pii.name, 'PII in Logs', 'medium'));
        }

        if (this.isClientSide(filePath)) {
          issues.push(this.createIssue(filePath, lineNum, pii.name, 'PII in Client-Side Code', 'high'));
        }
      }
    }

    return issues.slice(0, 5);
  }

  private static isLogging(line: string): boolean {
    return /console\.|print\(|log\(|logger\./.test(line);
  }

  private static isClientSide(path: string): boolean {
    return /client|frontend|public/.test(path);
  }

  private static createIssue(file: string, line: number, piiType: string, title: string, severity: any): SecurityIssue {
    return {
      file, line, severity, category: 'Privacy', title,
      description: `Potential ${piiType} exposure detected.`,
      impact: 'PII exposure violates GDPR/CCPA regulations.',
      remediation: 'Never log/expose PII. Use masking or server-side processing.'
    };
  }
}
