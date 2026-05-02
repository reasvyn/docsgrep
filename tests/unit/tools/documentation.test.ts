import { describe, it, expect, vi } from 'vitest';
import { handleHuntDocs, handlePeekFile } from '../../../src/tools/documentation.js';
import * as fs from 'node:fs/promises';
import { glob } from 'glob';

vi.mock('node:fs/promises');
vi.mock('glob');

describe('documentation tools', () => {
  describe('handleHuntDocs', () => {
    it('should list documentation files', async () => {
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(glob).mockResolvedValue(['docs/readme.md'] as any);

      const result = await handleHuntDocs({ dirPath: '/test' });
      expect(result.content[0].text).toContain('Found 1 documentation files');
    });
  });

  describe('handlePeekFile', () => {
    it('should read file content', async () => {
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true, size: 100 } as any);
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('hello world') as any);

      const result = await handlePeekFile({ filePath: '/test/file.md' });
      expect(result.content[0].text).toBe('hello world');
    });
  });
});
