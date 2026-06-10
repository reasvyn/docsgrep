import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { isBinaryFile, getCacheSize, cleanupCache, streamReadFile } from '../../../src/utils/file.js';
import { createReadStream, WriteStream } from 'node:fs';
import { Buffer } from 'node:buffer';

vi.mock('node:fs/promises');
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs') as any;
  return {
    ...actual,
    createReadStream: vi.fn(),
  };
});

describe('file utils', () => {
  describe('isBinaryFile', () => {
    it('should detect binary files with null bytes', () => {
      const binaryBuffer = Buffer.from([0x68, 0x65, 0x00, 0x6c, 0x6c, 0x6f]);
      expect(isBinaryFile(binaryBuffer)).toBe(true);
    });

    it('should detect text files (no null bytes)', () => {
      const textBuffer = Buffer.from('hello world');
      expect(isBinaryFile(textBuffer)).toBe(false);
    });
  });

  describe('getCacheSize', () => {
    it('should calculate recursive directory size', async () => {
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        { name: 'file1.txt', isDirectory: () => false },
        { name: 'subdir', isDirectory: () => true }
      ] as any);
      
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        { name: 'file2.txt', isDirectory: () => false }
      ] as any);

      vi.mocked(fs.stat).mockResolvedValue({ size: 100 } as any);

      const size = await getCacheSize('/fake/dir');
      expect(size).toBe(200); // 2 files of 100 bytes each
    });

    it('should return 0 on error', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('fail'));
      const size = await getCacheSize('/fake/dir');
      expect(size).toBe(0);
    });
  });

  describe('cleanupCache', () => {
    it('should remove old directories', async () => {
      const now = Date.now();
      const oldTime = now - (10 * 24 * 60 * 60 * 1000); // 10 days ago
      
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: 'old-repo', isDirectory: () => true },
        { name: 'new-repo', isDirectory: () => true },
        { name: 'not-a-dir', isDirectory: () => false }
      ] as any);

      vi.mocked(fs.stat).mockImplementation(async (p: any) => {
        if (p.includes('old-repo')) return { mtimeMs: oldTime } as any;
        return { mtimeMs: now } as any;
      });

      const cleaned = await cleanupCache('/fake/dir', 7 * 24 * 60 * 60 * 1000);
      expect(cleaned).toContain('old-repo');
      expect(cleaned).not.toContain('new-repo');
      expect(fs.rm).toHaveBeenCalledWith(expect.stringContaining('old-repo'), expect.any(Object));
    });
  });

  describe('streamReadFile', () => {
    it('should read file in chunks up to maxBytes', async () => {
      // Create a mock stream that is actually a Readable stream or mimics it simply
      const { Readable } = await import('node:stream');
      const mockReadStream = Readable.from(['line 1\n', 'line 2\n', 'line 3\n']);
      const destroySpy = vi.spyOn(mockReadStream, 'destroy');
      
      vi.mocked(createReadStream).mockReturnValue(mockReadStream as any);

      const result = await streamReadFile('/fake/file', 15);
      expect(result.content).toContain('line 1');
      expect(result.content).toContain('line 2');
      expect(result.content).not.toContain('line 3');
      expect(destroySpy).toHaveBeenCalled();
    });
  });
});
