import { describe, it, expect, vi } from 'vitest';
import { 
  handleHuntDocs, 
  handlePeekFile, 
  handleGrepDocs, 
  handleSenseSurroundings,
  handleFathomMeaning,
  handleTldrDocs,
  handleHuntRelated,
  handleSmellStale,
  handleGaugeDocs
} from '../../../src/tools/documentation.js';
import * as fs from 'node:fs/promises';
import { glob } from 'glob';
import * as path from 'node:path';

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

  describe('handleGrepDocs', () => {
    it('should return context lines when requested', async () => {
      vi.mocked(glob).mockResolvedValue(['readme.md'] as any);
      const content = 'line 1\nline 2 (match)\nline 3';
      vi.mocked(fs.readFile).mockResolvedValue(content as any);

      const result = await handleGrepDocs({ 
        dirPath: '/test', 
        pattern: 'match',
        contextLines: 1 
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.results[0].context).toEqual(['line 1', 'line 2 (match)', 'line 3']);
    });
  });

  describe('handleSenseSurroundings', () => {
    it('should boost relevance based on imports', async () => {
      vi.mocked(glob).mockResolvedValue(['docs/auth.md'] as any);
      
      // Mock the current file being read to extract imports
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        if (filePath.toString().includes('index.ts')) {
          return 'import { login } from "./auth.js"';
        }
        if (filePath.toString().includes('auth.md')) {
          return '# Auth Documentation';
        }
        return '';
      });

      const result = await handleSenseSurroundings({ 
        dirPath: '/test', 
        currentFilePath: '/test/src/index.ts' 
      });

      const data = JSON.parse(result.content[0].text);
      const authDoc = data.relevantDocs.find((d: any) => d.file.includes('auth.md'));
      expect(authDoc.relevance).toBe('high');
      expect(authDoc.reason).toBe('Related to an imported module');
    });
  });

  describe('handleFathomMeaning', () => {
    it('should find docs based on keyword scoring', async () => {
      vi.mocked(glob).mockResolvedValue(['docs/auth.md', 'docs/other.md'] as any);
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        if (filePath.toString().includes('auth.md')) return '# Authentication\nHow to login.';
        return 'Some other content.';
      });

      const result = await handleFathomMeaning({ dirPath: '/test', query: 'auth login' });
      const data = JSON.parse(result.content[0].text);
      expect(data.results[0].file).toContain('auth.md');
      expect(data.results[0].relevanceScore).toBeGreaterThan(0);
    });
  });

  describe('handleTldrDocs', () => {
    it('should summarize document headers', async () => {
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true, size: 100 } as any);
      vi.mocked(fs.readFile).mockResolvedValue('# Title\n## Header 1\nSome text.\n### Subheader' as any);

      const result = await handleTldrDocs({ filePath: '/test/doc.md', maxLength: 100 });
      const data = JSON.parse(result.content[0].text);
      expect(data.summary).toContain('# Title');
      expect(data.summary).toContain('## Header 1');
    });
  });

  describe('handleHuntRelated', () => {
    it('should find docs with overlapping keywords', async () => {
      vi.mocked(glob).mockResolvedValue(['docs/auth.md'] as any);
      vi.mocked(fs.readFile).mockResolvedValue('keyword1 keyword2 keyword3' as any);

      const result = await handleHuntRelated({ dirPath: '/test', topic: 'keyword1 keyword2' });
      const data = JSON.parse(result.content[0].text);
      expect(data.results[0].similarityScore).toBe(1);
    });
  });

  describe('handleSmellStale', () => {
    it('should detect stale documents based on mtime', async () => {
      vi.mocked(glob).mockResolvedValue(['old.md'] as any);
      const oldTime = Date.now() - (40 * 24 * 60 * 60 * 1000); // 40 days ago
      vi.mocked(fs.stat).mockResolvedValue({ mtimeMs: oldTime, mtime: new Date(oldTime) } as any);

      const result = await handleSmellStale({ dirPath: '/test', maxAgeDays: 30 });
      const data = JSON.parse(result.content[0].text);
      expect(data.staleDocuments.length).toBe(1);
      expect(data.staleDocuments[0].file).toContain('old.md');
    });
  });

  describe('handleGaugeDocs', () => {
    it('should calculate coverage for JS/TS with docblocks', async () => {
      vi.mocked(glob).mockResolvedValue(['src/test.ts'] as any);
      const content = '/**\n * Some docs\n */\nexport function documented() {}\n\nexport function undocumented() {}';
      vi.mocked(fs.readFile).mockResolvedValue(content as any);

      const result = await handleGaugeDocs({ dirPath: '/test', publicOnly: true });
      const data = JSON.parse(result.content[0].text);
      expect(data.summary.totalItems).toBe(2);
      expect(data.summary.documentedItems).toBe(1);
      expect(data.summary.coveragePercentage).toBe(50);
      expect(data.undocumentedList[0].item).toBe('undocumented');
    });

    it('should calculate coverage for Python with docstrings', async () => {
      vi.mocked(glob).mockResolvedValue(['main.py'] as any);
      const content = 'def documented():\n    """docstring"""\n    pass\n\ndef undocumented():\n    pass';
      vi.mocked(fs.readFile).mockResolvedValue(content as any);

      const result = await handleGaugeDocs({ dirPath: '/test', filePatterns: ['main.py'] });
      const data = JSON.parse(result.content[0].text);
      expect(data.summary.documentedItems).toBe(1);
      expect(data.summary.totalItems).toBe(2);
    });

    it('should calculate coverage for Go with comments', async () => {
      vi.mocked(glob).mockResolvedValue(['main.go'] as any);
      const content = '// Documented func\nfunc Documented() {}\n\nfunc Undocumented() {}';
      vi.mocked(fs.readFile).mockResolvedValue(content as any);

      const result = await handleGaugeDocs({ dirPath: '/test' });
      const data = JSON.parse(result.content[0].text);
      expect(data.summary.documentedItems).toBe(1);
      expect(data.summary.totalItems).toBe(2);
    });
  });
});
