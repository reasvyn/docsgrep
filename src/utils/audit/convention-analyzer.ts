/**
 * Code convention detection (naming, indentation, etc.)
 */

export class ConventionAnalyzer {
  static detectNaming(files: any[]): string {
    const scores: Record<string, number> = { camelCase: 0, snake_case: 0, PascalCase: 0, UPPER_SNAKE: 0 };
    for (const file of files) {
      const ids = file.content.match(/\b[a-zA-Z_]\w*\b/g) || [];
      for (const id of ids) {
        if (/^[a-z]+(?:[A-Z][a-z]*)*$/.test(id)) scores.camelCase++;
        if (/^[a-z]+(?:_[a-z]+)*$/.test(id)) scores.snake_case++;
        if (/^[A-Z][a-z]+(?:[A-Z][a-z]*)*$/.test(id)) scores.PascalCase++;
        if (/^[A-Z][a-z0-9_]*$/.test(id)) scores.UPPER_SNAKE++;
      }
    }
    return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  }

  static detectIndentation(content: string): string {
    const tabs = (content.match(/^\t/gm) || []).length;
    const spaces = (content.match(/^ {2}/gm) || []).length;
    return tabs > spaces ? 'tabs' : 'spaces';
  }

  static detectQuote(content: string): string {
    const single = (content.match(/'/g) || []).length;
    const double = (content.match(/"/g) || []).length;
    return double > single ? 'double' : 'single';
  }

  static calculateAvgLineLength(content: string): number {
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return 0;
    return Math.round(lines.reduce((acc, l) => acc + l.length, 0) / lines.length);
  }

  static hasComments(content: string): { has: boolean; style: string } {
    const single = (content.match(/\/\/|\#|--|%;/g) || []).length;
    const multi = (content.match(/\/\*|\*\/|"""|'''/g) || []).length;
    if (single === 0 && multi === 0) return { has: false, style: 'none' };
    return { has: true, style: single > multi ? 'single-line' : 'multi-line' };
  }
}
