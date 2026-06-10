/**
 * Language-agnostic code smell detection
 */
import { CodeSanitizer } from "../code-analysis.js";
import { type CodeIssue } from "../../types/audit.js";

export class SmellDetector {
  static detect(content: string, filePath: string, originalLines: string[]): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const ext = filePath.split('.').pop()?.toLowerCase() || 'ts';
    const sanitized = CodeSanitizer.stripComments(content, ext);
    const sanitizedLines = sanitized.split('\n');

    issues.push(...this.checkFileLength(originalLines, filePath));
    issues.push(...this.checkNesting(sanitizedLines, originalLines, filePath));
    issues.push(...this.checkComplexity(sanitizedLines, originalLines, filePath));
    issues.push(...this.checkShortNames(sanitized, originalLines, filePath));
    issues.push(...this.checkMagicNumbers(sanitized, filePath));
    issues.push(...this.checkTodos(content, originalLines, filePath));
    issues.push(...this.checkUnusedVars(sanitized, originalLines, filePath, ext));

    return issues.slice(0, 15);
  }

  private static checkFileLength(lines: string[], file: string): CodeIssue[] {
    if (lines.length <= 400) return [];
    return [{
      file, severity: 'medium', category: 'Maintainability', title: 'Long File',
      description: `File has ${lines.length} lines.`,
      suggestion: 'Split into smaller modules.'
    }];
  }

  private static checkNesting(sanLines: string[], origLines: string[], file: string): CodeIssue[] {
    let max = 0, current = 0;
    const numLines = sanLines.length;
    for (let i = 0; i < numLines; i++) {
      if (CodeSanitizer.isIgnored(origLines[i])) continue;
      current += (sanLines[i].match(/\{/g) || []).length;
      if (current > max) max = current;
      current -= (sanLines[i].match(/\}/g) || []).length;
    }
    if (max <= 4) return [];
    return [{
      file, severity: 'high', category: 'Readability', title: 'Deep Nesting',
      description: `Max nesting level is ${max}.`,
      suggestion: 'Use early returns or extract methods.'
    }];
  }

  private static checkComplexity(sanLines: string[], origLines: string[], file: string): CodeIssue[] {
    let total = 0;
    const branchRegex = /\b(if|else if|case|for|while|catch|&&|\|\|)\b/g;
    const numLines = sanLines.length;
    for (let i = 0; i < numLines; i++) {
      if (CodeSanitizer.isIgnored(origLines[i])) continue;
      const matches = sanLines[i].match(branchRegex) || [];
      total += matches.length;
    }
    if (total <= 40) return [];
    return [{
      file, severity: 'medium', category: 'Complexity', title: 'High Complexity',
      description: `Found ${total} logical branches.`,
      suggestion: 'Refactor complex logic.'
    }];
  }

  private static checkShortNames(san: string, orig: string[], file: string): CodeIssue[] {
    const regex = /\b(const|let|var|def|func|fn)\s+([a-zA-Z0-9_$]{1})\b/g;
    const issues: CodeIssue[] = [];
    let match;
    while ((match = regex.exec(san)) !== null) {
      const name = match[2];
      if (['i', 'j', 'k', 'x', 'y', 'z', 'e', 'v', '_'].includes(name.toLowerCase())) continue;
      const lineNum = san.substring(0, match.index).split('\n').length;
      if (CodeSanitizer.isIgnored(orig[lineNum - 1])) continue;
      issues.push({
        file, line: lineNum, severity: 'low', category: 'Readability', title: 'Cryptic Name',
        description: `Name '${name}' is too short.`,
        suggestion: 'Use descriptive names.'
      });
    }
    return issues;
  }

  private static checkMagicNumbers(san: string, file: string): CodeIssue[] {
    const regex = /(?<![.\w'"$])\d{2,}(?![.\w])/g;
    const matches = san.match(regex);
    if (!matches || matches.length <= 5) return [];
    const allowed = ['10', '20', '30', '40', '50', '60', '70', '80', '90', '100', '1000', '200', '400', '404', '500', '500000'];
    const filtered = matches.filter(n => !allowed.includes(n));
    if (filtered.length <= 3) return [];
    return [{
      file, severity: 'low', category: 'Code Quality', title: 'Magic Numbers',
      description: `Found ${filtered.length} magic numbers.`,
      suggestion: 'Extract to constants.'
    }];
  }

  private static checkTodos(content: string, orig: string[], file: string): CodeIssue[] {
    const regex = /\b(?:TODO|FIXME|HACK|XXX)\b/gi;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      if (CodeSanitizer.isIgnored(orig[lineNum - 1])) continue;
      return [{
        file, line: lineNum, severity: 'low', category: 'Technical Debt', title: 'Unresolved TODOs',
        description: `Found '${match[0]}' comment.`,
        suggestion: 'Address tracking tickets.'
      }];
    }
    return [];
  }

  private static checkUnusedVars(san: string, orig: string[], file: string, ext: string): CodeIssue[] {
    if (!['js', 'ts', 'jsx', 'tsx'].includes(ext)) return [];
    const regex = /\b(?:const|let|var)\s+(\w+)\s*[=;]/g;
    const issues: CodeIssue[] = [];
    let match;
    while ((match = regex.exec(san)) !== null) {
      const varName = match[1];
      const usages = san.match(new RegExp(`\\b${varName}\\b`, 'g'));
      if (usages && usages.length > 1) continue;
      const lineNum = san.substring(0, match.index).split('\n').length;
      if (CodeSanitizer.isIgnored(orig[lineNum - 1])) continue;
      issues.push({
        file, line: lineNum, severity: 'medium', category: 'Dead Code', title: 'Unused Variable',
        description: `Variable '${varName}' is not used.`,
        suggestion: 'Remove it.'
      });
    }
    return issues;
  }
}
