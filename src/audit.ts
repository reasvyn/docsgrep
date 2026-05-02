// Universal audit orchestrator - language agnostic
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob } from 'glob';
import { 
  performUniversalAudit, 
  generateUniversalAuditPrompt,
  type AuditReport,
  type CodeIssue 
} from './best-practices.js';

export { performUniversalAudit, generateUniversalAuditPrompt, type AuditReport, type CodeIssue };

// Helper to get prompt (re-export)
export async function getAuditPrompt(dirPath: string): Promise<string> {
  // Analyze structure for the prompt
  const structure = await analyzeProjectStructure(dirPath);
  return generateUniversalAuditPrompt(dirPath, {
    hasDocumentation: structure.hasDocumentation,
    hasLinterConfig: structure.hasLinterConfig,
    hasTests: structure.hasTests,
    hasCI: structure.hasCI,
    directories: structure.directories,
    entryPoints: [],
  });
}

// Re-analyze structure for prompt (lightweight)
async function analyzeProjectStructure(dirPath: string) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const directories = entries
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => e.name);

  const hasDocumentation = await fileExists(dirPath, ['README*', 'docs/**/*.md', 'DOCUMENTATION*']);
  const hasLinterConfig = await fileExists(dirPath, [
    '.eslintrc*', '.prettierrc*', 'tsconfig.json', '.editorconfig',
    '.rubocop.yml', '.flake8', 'phpcs.xml', 'rustfmt.toml', '.pylintrc'
  ]);
  const hasTests = await fileExists(dirPath, ['test/**', 'tests/**', 'spec/**', '__tests__/**']);
  const hasCI = await fileExists(dirPath, ['.github/workflows/**', '.gitlab-ci.yml', 'Jenkinsfile']);

  return { hasDocumentation, hasLinterConfig, hasTests, hasCI, directories };
}

async function fileExists(dirPath: string, patterns: string[]): Promise<boolean> {
  for (const pattern of patterns) {
    const matches = await glob(pattern, { cwd: dirPath, ignore: ['**/node_modules/**', '**/.git/**'] });
    if (matches.length > 0) return true;
  }
  return false;
}
