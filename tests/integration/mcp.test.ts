import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, '..', '..', 'build', 'index.js');

describe('MCP Server Integration', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
    });

    client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);
  }, 10000);

  afterAll(async () => {
    if (client) {
      await client.close();
    }
  });

  it('should list tools', async () => {
    const tools = await client.listTools();
    expect(tools.tools).toBeDefined();
    expect(tools.tools.length).toBeGreaterThan(0);
    expect(tools.tools.some(t => t.name === 'setup_camp')).toBe(true);
    expect(tools.tools.some(t => t.name === 'purge_cache')).toBe(true);
  });

  it('should validate setup_camp with invalid path', async () => {
    const result = await client.callTool({
      name: 'setup_camp',
      arguments: { projectPath: '' },
    });
    expect((result as any).isError).toBe(true);
  });

  it('should validate peek_file with path traversal', async () => {
    const result = await client.callTool({
      name: 'peek_file',
      arguments: { filePath: '../../etc/passwd' },
    });
    expect((result as any).isError).toBe(true);
  });
});
