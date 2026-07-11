import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeProjectStyle } from '../../src/project-style.js';
import * as fs from 'node:fs/promises';
import { glob } from 'glob';

vi.mock('node:fs/promises');
vi.mock('glob');

describe('project-style', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should detect tech stack and conventions', async () => {
    vi.mocked(glob).mockImplementation(async (pattern: any) => {
      if (typeof pattern === 'string' && pattern.includes('contribut')) return ['CONTRIBUTING.md'];
      if (Array.isArray(pattern) && pattern.some(p => p.includes('contribut'))) return ['CONTRIBUTING.md'];
      return ['src/main.ts'];
    });
    
    vi.mocked(fs.readFile).mockImplementation(async (p: any) => {
      if (p.toString().includes('CONTRIBUTING.md')) return '# How to contribute';
      return 'const myVar = 1;';
    });
    
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true, size: 100 } as any);

    const report = await analyzeProjectStyle('/test');
    expect(report.conventions.found).toBe(true);
    expect(report.patterns.sampled).toBeGreaterThan(0);
  });

  it('should handle empty projects', async () => {
    vi.mocked(glob).mockResolvedValue([]);
    const report = await analyzeProjectStyle('/test');
    expect(report.conventions.found).toBe(false);
  });
});
