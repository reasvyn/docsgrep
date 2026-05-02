import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDocTheTools, handleSpyStack, handleSniffStyle, handleFetchRepo } from '../../../src/tools/help-info.js';
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

  describe('handleDocTheTools', () => {
    it('should return list of all tools', async () => {
      const result = await handleDocTheTools({});
      const data = JSON.parse(result.content[0].text);
      expect(data.tools).toBeDefined();
      expect(Object.keys(data.tools).length).toBeGreaterThan(0);
    });

    it('should return help for specific tool', async () => {
      const result = await handleDocTheTools({ toolName: 'setup_camp' });
      const data = JSON.parse(result.content[0].text);
      expect(data.tool).toBe('setup_camp');
      expect(data.description).toBeDefined();
    });
  });

  describe('handleSpyStack', () => {
    it('should analyze package manager files', async () => {
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true, isFile: () => true, size: 100 } as any);
      vi.mocked(glob).mockResolvedValue(['package.json'] as any);
      vi.mocked(fs.readFile).mockResolvedValue('{"name": "test"}' as any);

      const result = await handleSpyStack({ dirPath: '/test' });
      const data = JSON.parse(result.content[0].text);
      expect(data.files['package.json']).toContain('test');
    });
  });

  describe('handleSniffStyle', () => {
    it('should analyze project style', async () => {
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(styleUtils.analyzeProjectStyle).mockResolvedValue({
        conventions: { found: 1, message: 'Found some.' },
        patterns: { sampled: 1, message: 'Sampled some.' },
        recommendations: []
      } as any);
      
      const result = await handleSniffStyle({ dirPath: '/test' });
      const data = JSON.parse(result.content[0].text);
      expect(data.message).toBeDefined();
      expect(data.conventions).toBeDefined();
    });
  });

  describe('handleFetchRepo', () => {
    it('should clone remote repo and find docs', async () => {
      vi.mocked(gitUtils.getRepoCachePath).mockReturnValue('/tmp/repo');
      vi.mocked(gitUtils.cloneOrUpdateRepo).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(glob).mockResolvedValue(['README.md'] as any);

      const result = await handleFetchRepo({ repoUrl: 'https://github.com/user/repo.git' });
      const data = JSON.parse(result.content[0].text);
      expect(data.files.length).toBeGreaterThan(0);
      expect(data.tempDirectory).toBe('/tmp/repo');
    });
  });
});
