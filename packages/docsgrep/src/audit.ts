// Universal audit orchestrator - language agnostic
import { 
  performUniversalAudit, 
  type AuditReport,
  type CodeIssue 
} from './best-practices.js';
import { generateUniversalAuditPrompt } from './utils/audit/prompts.js';
import { getIgnorePatterns } from './utils/file.js';
import { glob } from 'glob';
import * as path from 'node:path';

export { performUniversalAudit, generateUniversalAuditPrompt, type AuditReport, type CodeIssue };

// Helper to get prompt (re-export)
export async function getAuditPrompt(dirPath: string): Promise<string> {
  const ignorePatterns = await getIgnorePatterns(dirPath);
  const structure = await analyzeProjectStructure(dirPath, ignorePatterns);
  return generateUniversalAuditPrompt(dirPath, structure);
}

async function analyzeProjectStructure(dirPath: string, ignorePatterns: string[]) {
  const directories = (await glob('*/', { cwd: dirPath, ignore: ignorePatterns }))
    .map(d => d.replace(/\/$/, ''));

  const hasDocumentation = await fileExists(dirPath, ['README*', 'docs/**/*.md'], ignorePatterns);
  const hasLinterConfig = await fileExists(dirPath, ['.eslintrc*', 'tsconfig.json'], ignorePatterns);
  const hasTests = await fileExists(dirPath, ['tests/**', 'test/**'], ignorePatterns);
  const hasCI = await fileExists(dirPath, ['.github/**'], ignorePatterns);

  return { hasDocumentation, hasLinterConfig, hasTests, hasCI, directories };
}

async function fileExists(dirPath: string, patterns: string[], ignorePatterns: string[]): Promise<boolean> {
  for (const pattern of patterns) {
    const matches = await glob(pattern, { cwd: dirPath, ignore: ignorePatterns });
    if (matches.length > 0) return true;
  }
  return false;
}
