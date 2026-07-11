import { describe, it, expect } from 'vitest';
import { performUniversalAudit } from '../../src/best-practices.js';
import * as fs from 'node:fs/promises';
import { glob } from 'glob';
import { vi } from 'vitest';

vi.mock('node:fs/promises');
vi.mock('glob');

describe('code-smell-detection', () => {
  it('should detect complex expressions and high file complexity', async () => {
    const complexCode = `
      if (a && b || c && d) {
        if (e || f && g || h) {
          // nested
        }
      }
      // Add many branches to trigger high file complexity
      if (1) {} if (2) {} if (3) {} if (4) {} if (5) {}
      if (6) {} if (7) {} if (8) {} if (9) {} if (10) {}
      if (11) {} if (12) {} if (13) {} if (14) {} if (15) {}
      if (16) {} if (17) {} if (18) {} if (19) {} if (20) {}
      if (21) {} if (22) {} if (23) {} if (24) {} if (25) {}
      if (26) {} if (27) {} if (28) {} if (29) {} if (30) {}
      if (31) {} if (32) {} if (33) {} if (34) {} if (35) {}
      if (36) {} if (37) {} if (38) {} if (39) {} if (40) {}
      if (41) {}
    `;

    vi.mocked(glob).mockResolvedValue(['complex.ts'] as any);
    vi.mocked(fs.readFile).mockResolvedValue(complexCode);
    vi.mocked(fs.readdir).mockResolvedValue([]);

    const report = await performUniversalAudit('/test');
    const issues = report.issues;
    
    expect(issues.some(i => i.title === 'Complex Expression')).toBe(true);
    expect(issues.some(i => i.title === 'High File Complexity')).toBe(true);
  });

  it('should detect cryptic names', async () => {
    const codeWithCrypticNames = `
      const a = 1;
      let b = 2;
      var c = 3;
      function test(d) {
        const e = 4;
      }
    `;

    vi.mocked(glob).mockResolvedValue(['names.ts'] as any);
    vi.mocked(fs.readFile).mockResolvedValue(codeWithCrypticNames);
    
    const report = await performUniversalAudit('/test');
    const crypticIssues = report.issues.filter(i => i.title === 'Cryptic Name');
    
    expect(crypticIssues.length).toBeGreaterThan(0);
    expect(crypticIssues.some(i => i.description.includes("'a'"))).toBe(true);
  });

  it('should detect functions with too many parameters', async () => {
    const codeWithManyParams = `
      function tooManyParams(p1, p2, p3, p4, p5, p6) {
        return p1;
      }
      
      const arrowWithMany = (a, b, c, d, e, f, g) => a + b;
    `;

    vi.mocked(glob).mockResolvedValue(['params.ts'] as any);
    vi.mocked(fs.readFile).mockResolvedValue(codeWithManyParams);
    
    const report = await performUniversalAudit('/test');
    const paramIssues = report.issues.filter(i => i.title === 'Too Many Parameters');
    
    expect(paramIssues.length).toBe(2);
    expect(paramIssues[0].description).toContain('6 parameters');
  });
});
