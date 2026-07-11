import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAuditPrompt } from '../../src/audit.js';
import * as fs from 'node:fs/promises';
import { glob } from 'glob';

vi.mock('node:fs/promises');
vi.mock('glob');

describe('audit', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should generate audit prompt based on structure', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'src', isDirectory: () => true, isFile: () => false },
      { name: 'README.md', isDirectory: () => false, isFile: () => true }
    ] as any);
    
    vi.mocked(glob).mockImplementation(async (pattern: any) => {
      if (pattern.includes('README')) return ['README.md'];
      return [];
    });

    const prompt = await getAuditPrompt('/test');
    expect(prompt).toContain('Universal Code Quality Audit');
    expect(prompt).toContain('Documentation: ✅ Present');
    expect(prompt).toContain('Tests: ❌ Missing');
  });
});
