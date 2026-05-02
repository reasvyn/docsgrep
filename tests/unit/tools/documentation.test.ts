import { describe, it, expect, vi } from 'vitest';
import { handleHuntDocs, handlePeekFile, handleGrepDocs, handleSenseSurroundings } from '../../../src/tools/documentation.js';
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
});
