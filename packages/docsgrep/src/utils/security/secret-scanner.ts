/**
 * Secret and Credential Scanner
 */
import { CodeSanitizer } from "../code-analysis.js";
import { SECRET_PATTERNS } from "./patterns.js";

export class SecretScanner {
  static scan(content: string, filePath: string): Array<{file: string; line?: number; type: string; value?: string}> {
    const found: Array<{file: string; line?: number; type: string; value?: string}> = [];
    const ext = filePath.split('.').pop()?.toLowerCase() || 'ts';
    
    if (this.isNonSensitiveFile(filePath)) return found;
    
    const lines = content.split('\n');
    const sanitizedContent = CodeSanitizer.stripComments(content, ext);

    for (const secret of SECRET_PATTERNS) {
      secret.pattern.lastIndex = 0;
      let match;
      
      while ((match = secret.pattern.exec(sanitizedContent)) !== null) {
        const lineNum = sanitizedContent.substring(0, match.index).split('\n').length;
        if (CodeSanitizer.isIgnored(lines[lineNum - 1])) continue;

        found.push({
          file: filePath,
          line: lineNum,
          type: secret.name,
          value: match[0].substring(0, 15) + '...',
        });
      }
    }

    return found;
  }

  private static isNonSensitiveFile(path: string): boolean {
    const low = path.toLowerCase();
    return low.includes('example') || low.includes('sample') || low.includes('.test.') || low.includes('node_modules');
  }
}
