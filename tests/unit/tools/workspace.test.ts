import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSetupCamp, handlePurgeCache } from '../../../src/tools/workspace.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

vi.mock('node:fs/promises');

describe('workspace tools', () => {
  describe('handleSetupCamp', () => {
    it('should initialize workspace in project directory by default', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(''); // Mock for .gitignore
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

      const result = await handleSetupCamp({ projectPath: '/test/project' });
      expect(result.content[0].text).toContain('initialized docsgrep workspace');
      expect(result.content[0].text).toContain('project directory');
    });

    it('should fallback to system temp if project dir fails', async () => {
      // Mock mkdir to fail for project local but succeed for system temp
      vi.mocked(fs.mkdir).mockImplementation(async (p: any) => {
        if (p.toString().includes('.docsgrep')) throw new Error('Permission denied');
        return undefined;
      });
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await handleSetupCamp({ projectPath: '/test/project' });
      expect(result.content[0].text).toContain('system temp directory');
    });
  });

  describe('handlePurgeCache', () => {
    it('should clean cache and return size info', async () => {
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true, size: 1024 * 1024 } as any);
      vi.mocked(fs.readdir).mockResolvedValue([]);
      
      const result = await handlePurgeCache({ localProjectPath: '/test/project' });
      const data = JSON.parse(result.content[0].text);
      expect(data.message).toContain('Cleaned up');
      expect(data.cacheSizeMB).toBeDefined();
    });
  });
});
