import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, '..', '..', 'src', 'index.ts');

describe('MCP Server Integration', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'npx',
      args: [
        'tsx',
        serverPath,
      ],
    });

    client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);
  }, 30000);

  afterAll(async () => {
    if (client) {
      await client.close();
    }
  });

  it('should list tools', async () => {
    const tools = await client.listTools();
    expect(tools.tools).toBeDefined();
    expect(tools.tools.length).toBeGreaterThan(0);
    expect(tools.tools.some(t => t.name === 'init_workspace')).toBe(true);
    expect(tools.tools.some(t => t.name === 'clear_cache')).toBe(true);
  });

  it('should validate init_workspace with invalid path', async () => {
    const result = await client.callTool({
      name: 'init_workspace',
      arguments: { projectPath: '' },
    });
    expect((result as any).isError).toBe(true);
  });

  it('should validate read_file with path traversal', async () => {
    const result = await client.callTool({
      name: 'read_file',
      arguments: { filePath: '../../etc/passwd' },
    });
    expect((result as any).isError).toBe(true);
  });
});
