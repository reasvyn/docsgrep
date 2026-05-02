import { describe, it, expect, vi } from 'vitest';
import { handleSetupCamp } from '../../../src/tools/workspace.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

vi.mock('node:fs/promises');
vi.mock('node:os');

describe('handleSetupCamp', () => {
  it('should initialize workspace and return success message', async () => {
    vi.mocked(os.tmpdir).mockReturnValue('/tmp');
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue('');

    const result = await handleSetupCamp({ projectPath: '/test/project' });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Successfully initialized docsgrep workspace');
  });

  it('should return error for invalid path', async () => {
    const result = await handleSetupCamp({ projectPath: '' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error');
  });
});
