import { describe, it, expect, vi, beforeEach } from 'vitest';
import { performUniversalAudit } from '../../src/best-practices.js';
import * as fs from 'node:fs/promises';
import { glob } from 'glob';

vi.mock('node:fs/promises');
vi.mock('glob');

describe('best-practices', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should analyze project and detect code smells', async () => {
    vi.mocked(glob).mockImplementation(async (pattern: any) => {
      if (pattern.includes('**/*.{js,ts')) return ['src/main.ts', 'src/utils.ts'];
      if (pattern.includes('README')) return ['README.md'];
      return [];
    });
    
    vi.mocked(fs.readFile).mockImplementation(async (p: any) => {
      if (p.toString().includes('main.ts')) {
        return 'function veryLongFunction() {\n' + '  // '.repeat(100) + '\n}';
      }
      return 'const x = 1;';
    });
    
    vi.mocked(fs.readdir).mockResolvedValue([{ name: 'src', isDirectory: () => true, isFile: () => false }] as any);

    const report = await performUniversalAudit('/test');
    expect(report.summary.filesScanned).toBeGreaterThan(0);
    expect(report.projectStructure.hasDocumentation).toBe(true);
  });

  it('should detect naming conventions', async () => {
    vi.mocked(glob).mockResolvedValue(['src/main.ts'] as any);
    vi.mocked(fs.readFile).mockResolvedValue('const myVar = 1; const otherVar = 2;' as any);
    vi.mocked(fs.readdir).mockResolvedValue([]);

    const report = await performUniversalAudit('/test');
    expect(report.detectedConventions.namingStyle).toBe('camelCase');
  });

  it('should detect indentation', async () => {
    vi.mocked(glob).mockResolvedValue(['src/main.ts'] as any);
    vi.mocked(fs.readFile).mockResolvedValue('\tconst x = 1;\n\tconst y = 2;' as any);
    vi.mocked(fs.readdir).mockResolvedValue([]);

    const report = await performUniversalAudit('/test');
    expect(report.detectedConventions.indentation).toBe('tabs');
  });
});
