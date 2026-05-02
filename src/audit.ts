// Universal audit orchestrator - language agnostic
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob } from 'glob';
import { getIgnorePatterns } from './utils/file.js';
import { 
  performUniversalAudit, 
  generateUniversalAuditPrompt,
  type AuditReport,
  type CodeIssue 
} from './best-practices.js';

export { performUniversalAudit, generateUniversalAuditPrompt, type AuditReport, type CodeIssue };

// Helper to get prompt (re-export)
export async function getAuditPrompt(dirPath: string): Promise<string> {
  const ignorePatterns = await getIgnorePatterns(dirPath);
  // Analyze structure for the prompt - use system temp, not .docsgrep
  const structure = await analyzeProjectStructure(dirPath, ignorePatterns);
  return generateUniversalAuditPrompt(dirPath, {
    hasDocumentation: structure.hasDocumentation,
    hasLinterConfig: structure.hasLinterConfig,
    hasTests: structure.hasTests,
    hasCI: structure.hasCI,
    directories: structure.directories,
    entryPoints: [],
  });
}

// No longer need .docsgrep workspace functions

// Re-analyze structure for prompt (lightweight)
async function analyzeProjectStructure(dirPath: string, ignorePatterns: string[]) {
  const directories = (await glob('*/', { cwd: dirPath, ignore: ignorePatterns }))
    .map(d => d.replace(/\/$/, ''));

  const hasDocumentation = await fileExists(dirPath, ['README*', 'docs/**/*.md', 'DOCUMENTATION*'], ignorePatterns);
  const hasLinterConfig = await fileExists(dirPath, [
    '.eslintrc*', '.prettierrc*', 'tsconfig.json', '.editorconfig',
    '.rubocop.yml', '.flake8', 'phpcs.xml', 'rustfmt.toml', '.pylintrc'
  ], ignorePatterns);
  const hasTests = await fileExists(dirPath, ['test/**', 'tests/**', 'spec/**', '__tests__/**'], ignorePatterns);
  const hasCI = await fileExists(dirPath, ['.github/workflows/**', '.gitlab-ci.yml', 'Jenkinsfile'], ignorePatterns);

  return { hasDocumentation, hasLinterConfig, hasTests, hasCI, directories };
}

async function fileExists(dirPath: string, patterns: string[], ignorePatterns: string[]): Promise<boolean> {
  for (const pattern of patterns) {
    const matches = await glob(pattern, { cwd: dirPath, ignore: ignorePatterns });
    if (matches.length > 0) return true;
  }
  return false;
}
