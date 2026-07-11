import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneOrUpdateRepo, getRepoCachePath } from '../../../src/utils/git.js';
import { simpleGit } from 'simple-git';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

vi.mock('simple-git');
vi.mock('node:fs/promises');

describe('git utils', () => {
  const mockGit: any = {
    fetch: vi.fn().mockReturnThis(),
    reset: vi.fn().mockReturnThis(),
    clean: vi.fn().mockReturnThis(),
    clone: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(simpleGit).mockReturnValue(mockGit);
  });

  describe('cloneOrUpdateRepo', () => {
    it('should clone repo if it does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('not found'));
      
      await cloneOrUpdateRepo('https://github.com/user/repo.git', '/target/dir');
      
      expect(mockGit.clone).toHaveBeenCalledWith(
        'https://github.com/user/repo.git', 
        '/target/dir', 
        ['--depth', '1']
      );
    });

    it('should update repo if it exists', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      
      await cloneOrUpdateRepo('https://github.com/user/repo.git', '/target/dir');
      
      expect(mockGit.fetch).toHaveBeenCalled();
      expect(mockGit.reset).toHaveBeenCalledWith(['--hard', 'FETCH_HEAD']);
      expect(mockGit.clean).toHaveBeenCalled();
    });

    it('should handle authentication in URL', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('not found'));
      
      await cloneOrUpdateRepo('https://github.com/user/repo.git', '/target/dir', {
        authToken: 'mytoken'
      });
      
      expect(mockGit.clone).toHaveBeenCalledWith(
        'https://mytoken@github.com/user/repo.git', 
        '/target/dir', 
        ['--depth', '1']
      );
    });
  });

  describe('getRepoCachePath', () => {
    it('should return a path in user home by default', () => {
      const repoUrl = 'https://github.com/user/repo.git';
      const cachePath = getRepoCachePath(repoUrl);
      
      expect(cachePath).toContain(os.homedir());
      expect(cachePath).toContain('.docsgrep');
      expect(cachePath).toContain('repo');
    });

    it('should include branch in path if provided', () => {
      const repoUrl = 'https://github.com/user/repo.git';
      const cachePath = getRepoCachePath(repoUrl, { branch: 'develop' });
      
      expect(cachePath).toContain('develop');
    });
  });
});
