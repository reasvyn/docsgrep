import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob } from 'glob';
import { runAudit, getBestPracticesForTechStack, type AuditFinding } from './best-practices.js';
import { analyzeProjectContext } from './index.js';

export interface AuditReport {
  summary: {
    filesScanned: number;
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  techStack: Record<string, string>;
  conventions: string[];
  bestPracticesApplied: string[];
  findings: AuditFinding[];
  recommendations: string[];
}

export async function performAudit(dirPath: string, filePatterns?: string[]): Promise<AuditReport> {
  // Step 1: Analyze tech stack
  const techStack = await analyzeProjectContext(dirPath);
  
  // Step 2: Get applicable best practices
  const practices = getBestPracticesForTechStack(techStack);
  const bestPracticesApplied = practices.map(p => `${p.category}: ${p.title}`);
  
  // Step 3: Gather conventions (linter configs, etc.)
  const conventions = await gatherConventions(dirPath);
  
  // Step 4: Find files to audit
  const patterns = filePatterns || [
    'src/**/*.{js,ts,jsx,tsx,py,go,rs,rb,java,cpp,c,cs,php}',
    'app/**/*.{js,ts,jsx,tsx,py,go,rs,rb,java,cpp,c,cs,php}',
    'lib/**/*.{js,ts,jsx,tsx,py,go,rs,rb,java,cpp,c,cs,php}',
  ];
  
  const filesToAudit: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd: dirPath,
      ignore: ['**/node_modules/**', '**/vendor/**', '**/.git/**', '**/dist/**', '**/build/**', '**/*.test.*', '**/*.spec.*'],
    });
    filesToAudit.push(...matches.map(f => path.join(dirPath, f)));
  }
  
  // Deduplicate
  const uniqueFiles = [...new Set(filesToAudit)];
  
  // Step 5: Audit each file
  const allFindings: AuditFinding[] = [];
  
  for (const file of uniqueFiles) {
    try {
      const stat = await fs.stat(file);
      if (!stat.isFile() || stat.size > 200000) continue; // Skip files > 200KB
      
      const content = await fs.readFile(file, 'utf-8');
      const findings = runAudit(content, file, practices);
      allFindings.push(...findings);
    } catch (e) {
      // Skip files that can't be read
    }
  }
  
  // Step 6: Generate summary
  const summary = {
    filesScanned: uniqueFiles.length,
    totalFindings: allFindings.length,
    critical: allFindings.filter(f => f.severity === 'critical').length,
    high: allFindings.filter(f => f.severity === 'high').length,
    medium: allFindings.filter(f => f.severity === 'medium').length,
    low: allFindings.filter(f => f.severity === 'low').length,
  };
  
  // Step 7: Generate recommendations
  const recommendations = generateRecommendations(allFindings, techStack);
  
  return {
    summary,
    techStack,
    conventions,
    bestPracticesApplied,
    findings: allFindings.slice(0, 100), // Limit to 100 findings to avoid huge responses
    recommendations,
  };
}

async function gatherConventions(dirPath: string): Promise<string[]> {
  const conventionPatterns = [
    '**/.eslintrc*', '**/eslint.config.*', '**/.prettierrc*', '**/prettier.config.*',
    '**/.editorconfig', '**/phpcs.xml', '**/.flake8', '**/.rubocop.yml', '**/rustfmt.toml',
    '**/*lint*rc*', '**/tsconfig.json', '**/.pylintrc',
  ];
  
  const found: string[] = [];
  for (const pattern of conventionPatterns) {
    const matches = await glob(pattern, {
      cwd: dirPath,
      ignore: ['**/node_modules/**', '**/vendor/**', '**/.git/**'],
    });
    found.push(...matches);
  }
  
  return [...new Set(found)];
}

function generateRecommendations(findings: AuditFinding[], techStack: Record<string, string>): string[] {
  const recommendations: string[] = [];
  
  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const highCount = findings.filter(f => f.severity === 'high').length;
  
  if (criticalCount > 0) {
    recommendations.push(`Address ${criticalCount} critical issues immediately - these may lead to bugs or security vulnerabilities.`);
  }
  
  if (highCount > 0) {
    recommendations.push(`Fix ${highCount} high-severity issues to improve code quality and maintainability.`);
  }
  
  // Check for specific patterns
  const categories = [...new Set(findings.map(f => f.category))];
  
  if (categories.includes('Dead Code')) {
    recommendations.push('Remove dead code (unused imports, variables, functions) to reduce bundle size and improve clarity.');
  }
  
  if (categories.includes('Code Structure')) {
    recommendations.push('Refactor large files/classes into smaller, focused modules following Single Responsibility Principle.');
  }
  
  if (categories.includes('Next.js')) {
    recommendations.push('Follow Next.js App Router best practices: use Server Components by default, proper data fetching patterns.');
  }
  
  if (categories.includes('React Performance')) {
    recommendations.push('Optimize React components: avoid anonymous functions in JSX, use React.memo, useCallback, useMemo where appropriate.');
  }
  
  // Check if linter is configured
  const hasLinter = Object.keys(techStack).some(k => k.includes('eslint') || k.includes('lint') || k.includes('.eslintrc'));
  if (!hasLinter && Object.keys(techStack).some(k => k.includes('package.json'))) {
    recommendations.push('Consider adding ESLint and Prettier to enforce code quality automatically.');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Code quality looks good! Continue following best practices.');
  }
  
  return recommendations;
}

// Interactive audit helper - asks user what to audit
export function generateAuditPrompt(dirPath: string, techStack: Record<string, string>): string {
  const files = Object.keys(techStack);
  const hasPackageJson = files.some(f => f.includes('package.json'));
  const hasPython = files.some(f => f.includes('requirements.txt') || f.includes('pyproject'));
  
  let prompt = `## Code Quality Audit Request\n\n`;
  prompt += `I want to audit the code quality of: \`${dirPath}\`\n\n`;
  prompt += `### Detected Tech Stack:\n`;
  
  if (hasPackageJson) {
    prompt += `- JavaScript/TypeScript project\n`;
    if (Object.keys(techStack).some(k => k.includes('next'))) prompt += `  - Next.js detected\n`;
    if (Object.keys(techStack).some(k => k.includes('react'))) prompt += `  - React detected\n`;
  }
  
  if (hasPython) {
    prompt += `- Python project\n`;
  }
  
  prompt += `\n### What would you like to audit?\n`;
  prompt += `1. **Full Audit** - Scan all source files for quality issues\n`;
  prompt += `2. **Specific Directory** - Audit only a specific directory (e.g., \`src/components\`)\n`;
  prompt += `3. **Specific Files** - Audit specific files or patterns (e.g., \`**/*.tsx\`)\n`;
  prompt += `4. **Focus Area** - Focus on specific issues (dead code, structure, performance, etc.)\n\n`;
  prompt += `Please specify your choice and I will generate a comprehensive audit report.`;
  
  return prompt;
}
