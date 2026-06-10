import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkCapabilities, getCapabilityGapMessage } from '../../../src/utils/capabilities.js';
import { exec } from 'node:child_process';

vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}));

describe('capabilities', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('checkCapabilities', () => {
    it('should detect all tools when available', async () => {
      vi.mocked(exec).mockImplementation(((cmd: string, callback: any) => {
        callback(null, { stdout: 'version 1.0.0' });
      }) as any);

      const status = await checkCapabilities();
      expect(status.git).toBe(true);
      expect(status.npm).toBe(true);
      expect(status.docker).toBe(true);
      expect(status.osvScanner).toBe(true);
    });

    it('should detect missing tools when exec fails', async () => {
      vi.mocked(exec).mockImplementation(((cmd: string, callback: any) => {
        if (cmd.includes('git')) {
          callback(null, { stdout: 'version 1.0.0' });
        } else {
          callback(new Error('command not found'));
        }
      }) as any);

      const status = await checkCapabilities();
      expect(status.git).toBe(true);
      expect(status.npm).toBe(false);
      expect(status.docker).toBe(false);
      expect(status.osvScanner).toBe(false);
    });
  });

  describe('getCapabilityGapMessage', () => {
    it('should return messages for missing git and osv-scanner', () => {
      const status = {
        git: false,
        npm: true,
        docker: true,
        osvScanner: false,
      };
      const messages = getCapabilityGapMessage(status);
      expect(messages.length).toBe(2);
      expect(messages[0]).toContain('Git is missing');
      expect(messages[1]).toContain('OSV-Scanner is missing');
    });

    it('should return empty array when all required tools are present', () => {
      const status = {
        git: true,
        npm: true,
        docker: true,
        osvScanner: true,
      };
      const messages = getCapabilityGapMessage(status);
      expect(messages.length).toBe(0);
    });
  });
});
