import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleShowHelp, handleDetectStack, handleCheckStyle, handleCloneRepo } from '../../../src/tools/help-info.js';
import * as fs from 'node:fs/promises';
import { glob } from 'glob';
import * as gitUtils from '../../../src/utils/git.js';
import * as styleUtils from '../../../src/project-style.js';

vi.mock('node:fs/promises');
vi.mock('glob');
vi.mock('../../../src/utils/git.js');
vi.mock('../../../src/project-style.js');

describe('help-info tools', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('handleShowHelp', () => {
    it('should return list of all tools', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['init_workspace.md', 'find_docs.md'] as any);
      vi.mocked(fs.readFile).mockImplementation(async (p: any) => {
        if (p.toString().includes('init_workspace.md')) return '# `init_workspace`\n\nInitialize workspace.';
        if (p.toString().includes('find_docs.md')) return '# `find_docs`\n\nFind documentation files.';
        return '';
      });

      const result = await handleShowHelp({});
      expect(result.content[0].text).toContain('Available Tools');
      expect(result.content[0].text).toContain('init_workspace');
      expect(result.content[0].text).toContain('find_docs');
    });

    it('should return help for specific tool', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue('# `init_workspace`\n\nInitialize workspace.\n\n## Example\n\n```\ninit_workspace(projectPath: "/path")\n```');

      const result = await handleShowHelp({ toolName: 'init_workspace' });
      expect(result.content[0].text).toContain('init_workspace');
      expect(result.content[0].text).toContain('Initialize workspace');
    });

    it('should return error for unknown tool', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const result = await handleShowHelp({ toolName: 'nonexistent_tool' });
      expect((result as any).isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });
  });

  describe('handleDetectStack', () => {
    it('should analyze package manager files', async () => {
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true, isFile: () => true, size: 100 } as any);
      vi.mocked(glob).mockResolvedValue(['package.json'] as any);
      vi.mocked(fs.readFile).mockResolvedValue('{"name": "test"}' as any);

      const result = await handleDetectStack({ dirPath: '/test' });
      const data = JSON.parse(result.content[0].text);
      expect(data.files['package.json']).toContain('test');
    });
  });

  describe('handleCheckStyle', () => {
    it('should analyze project style', async () => {
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true, isFile: () => true, size: 100 } as any);
      vi.mocked(glob).mockResolvedValue([] as any);
      vi.mocked(fs.readFile).mockResolvedValue('' as any);

      const result = await handleCheckStyle({ dirPath: '/test' });
      const data = JSON.parse(result.content[0].text);
      expect(data.conventions).toBeDefined();
    });
  });

  describe('handleCloneRepo', () => {
    it('should clone remote repo and find docs', async () => {
      vi.mocked(gitUtils.getRepoCachePath).mockReturnValue('/tmp/repo');
      vi.mocked(gitUtils.cloneOrUpdateRepo).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(glob).mockResolvedValue(['README.md'] as any);

      const result = await handleCloneRepo({ repoUrl: 'https://github.com/user/repo.git' });
      const data = JSON.parse(result.content[0].text);
      expect(data.files.length).toBeGreaterThan(0);
      expect(data.cachePath).toBe('/tmp/repo');
    });
  });
});
