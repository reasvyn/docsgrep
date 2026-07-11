import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSyncDocumentation, handleVerifyDocs, handleCheckDelta, handleCheckArtefacts } from '../../../src/tools/sync-verify.js';
import * as fs from 'node:fs/promises';
import { glob } from 'glob';
import { simpleGit } from 'simple-git';

vi.mock('node:fs/promises');
vi.mock('glob');
vi.mock('simple-git');

describe('sync-verify tools', () => {
  const mockGit: any = {
    status: vi.fn(),
    log: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(simpleGit).mockReturnValue(mockGit);
    
    mockGit.status.mockResolvedValue({ 
      modified: ['src/index.ts'], 
      created: [], 
      renamed: [],
      not_added: [],
      deleted: [],
      staged: [],
      ahead: 0,
      behind: 0,
      current: 'main',
      tracking: 'origin/main',
      isClean: () => false
    });
    
    mockGit.log.mockResolvedValue({ 
      all: [
        { 
          hash: 'abc', 
          date: '2021-01-01', 
          message: 'test', 
          author_name: 'test', 
          author_email: 'test',
          diff: { files: [{ file: 'index.ts' }] } 
        }
      ] 
    });
  });

  describe('handleSyncDocumentation', () => {
    it('should detect changed files using git', async () => {
      const result = await handleSyncDocumentation({ dirPath: '/test' });
      const data = JSON.parse(result.content[0].text);
      expect(data.changedFiles.length).toBeGreaterThan(0);
      expect(data.changedFiles[0]).toContain('index.ts');
    });
  });

  describe('handleVerifyDocs', () => {
    it('should detect signature mismatch', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (p: any) => {
        if (p.toString().includes('api.md')) return 'function myMethod(param1)';
        return 'function myMethod(param1, param2) {}'; // Code has 2 params, doc has 1
      });
      vi.mocked(glob).mockResolvedValue(['src/main.ts'] as any);

      const result = await handleVerifyDocs({ dirPath: '/test', docPath: 'api.md' });
      const data = JSON.parse(result.content[0].text);
      expect(data.issues[0].status).toBe('signature_mismatch');
    });

    it('should report not_found for missing symbols', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (p: any) => {
        if (p.toString().includes('api.md')) return 'function missingMethod()';
        return 'function otherMethod() {}';
      });
      vi.mocked(glob).mockResolvedValue(['src/main.ts'] as any);

      const result = await handleVerifyDocs({ dirPath: '/test', docPath: 'api.md' });
      const data = JSON.parse(result.content[0].text);
      expect(data.issues[0].status).toBe('not_found');
    });
  });

  describe('handleCheckDelta', () => {
    it('should compare documented items with implementation', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (p: any) => {
        if (p.toString().includes('api.md')) return 'function myMethod()\nclass MyClass';
        return 'function myMethod() {}';
      });
      vi.mocked(glob).mockResolvedValue(['src/main.ts'] as any);

      const result = await handleCheckDelta({ dirPath: '/test', docPath: 'api.md' });
      const data = JSON.parse(result.content[0].text);
      expect(data.deltas.find((d: any) => d.item === 'myMethod').codeStatus).toContain('found');
      expect(data.deltas.find((d: any) => d.item === 'MyClass').codeStatus).toContain('NOT FOUND');
    });
  });

  describe('handleCheckArtefacts', () => {
    it('should identify docs needing updates based on code changes', async () => {
      vi.mocked(glob).mockResolvedValue(['docs/index.md'] as any);
      
      const result = await handleCheckArtefacts({ dirPath: '/test' });
      const data = JSON.parse(result.content[0].text);
      expect(data.staleArtefacts.length).toBeGreaterThan(0);
      expect(data.staleArtefacts[0].file).toContain('index.md');
    });
  });
});
