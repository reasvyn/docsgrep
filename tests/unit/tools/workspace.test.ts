import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleInitWorkspace, handleClearCache } from '../../../src/tools/workspace.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

vi.mock('node:fs/promises');

describe('workspace tools', () => {
  describe('handleInitWorkspace', () => {
    it('should initialize workspace in .docsgrep/ at project root', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue('');
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await handleInitWorkspace({ projectPath: '/test/project' });
      expect(result.content[0].text).toContain('initialized docsgrep workspace');
      expect(result.content[0].text).toContain('/test/project/.docsgrep');
    });

    it('should return error when project dir is invalid', async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Permission denied'));
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const result = await handleInitWorkspace({ projectPath: '/nonexistent' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error initializing workspace');
    });
  });

  describe('handleClearCache', () => {
    it('should clean cache and return size info', async () => {
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true, size: 1024 * 1024 } as any);
      vi.mocked(fs.readdir).mockResolvedValue([]);
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await handleClearCache({ localProjectPath: '/test/project' });
      const data = JSON.parse(result.content[0].text);
      expect(data.message).toContain('Cleaned up');
      expect(data.cacheSizeMB).toBeDefined();
    });
  });
});
