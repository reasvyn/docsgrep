import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, '..', '..', 'src', 'index.ts');

describe('New Tools - Integration Tests', () => {
  let client: Client;
  let transport: StdioClientTransport;
  let testDocPath: string;
  let testProjectPath: string;

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

    // Create test project with sample docs
    testProjectPath = path.join(__dirname, 'test-project');
    await fs.mkdir(testProjectPath, { recursive: true });
    await fs.mkdir(path.join(testProjectPath, 'docs'), { recursive: true });

    // Create sample doc
    testDocPath = path.join(testProjectPath, 'docs', 'api.md');
    await fs.writeFile(
      testDocPath,
      `# API Documentation

## Authentication

The authentication system uses JWT tokens.

### Methods

function login(username, password) {
  // Implementation
}

function logout() {
  // Implementation
}
`
    );

    // Create sample code file for verification
    await fs.mkdir(path.join(testProjectPath, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(testProjectPath, 'src', 'auth.ts'),
      `export function login(username: string, password: string) { return true; }
export function logout() { return; }
`
    );
  }, 30000);

  afterAll(async () => {
    if (client) {
      await client.close();
    }
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  });

  describe('Tool Existence', () => {
    it('should list all new tools', async () => {
      const tools = await client.listTools();
      const toolNames = tools.tools.map((t) => t.name);

      expect(toolNames).toContain('semantic_search');
      expect(toolNames).toContain('summarize_doc');
      expect(toolNames).toContain('find_related');
      expect(toolNames).toContain('check_stale');
      expect(toolNames).toContain('sync_documentation');
      expect(toolNames).toContain('verify_docs');
      expect(toolNames).toContain('get_context');
      expect(toolNames).toContain('check_delta');
      expect(toolNames).toContain('show_help');
      expect(toolNames).toContain('check_artefacts');
    });
  });

  describe('semantic_search', () => {
    it('should perform semantic search', async () => {
      const result = await client.callTool({
        name: 'semantic_search',
        arguments: {
          dirPath: testProjectPath,
          query: 'authentication login',
        },
      });

      const data = JSON.parse((result.content as any)[0].text);
      expect(data.results).toBeDefined();
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.results[0].file).toContain('api.md');
    });

    it('should respect topK parameter', async () => {
      const result = await client.callTool({
        name: 'semantic_search',
        arguments: {
          dirPath: testProjectPath,
          query: 'auth',
          topK: 1,
        },
      });

      const data = JSON.parse((result.content as any)[0].text);
      expect(data.results.length).toBeLessThanOrEqual(1);
    });

    it('should validate required parameters', async () => {
      const result = await client.callTool({
        name: 'semantic_search',
        arguments: {
          dirPath: testProjectPath,
        },
      });

      expect((result as any).isError).toBe(true);
    });
  });

  describe('summarize_doc', () => {
    it('should summarize documentation', async () => {
      const result = await client.callTool({
        name: 'summarize_doc',
        arguments: {
          filePath: testDocPath,
        },
      });

      const data = JSON.parse((result.content as any)[0].text);
      expect(data.summary).toBeDefined();
      expect(data.summaryLength).toBeGreaterThan(0);
      expect(data.originalLength).toBeGreaterThan(0);
    });

    it('should respect maxLength parameter', async () => {
      const result = await client.callTool({
        name: 'summarize_doc',
        arguments: {
          filePath: testDocPath,
          maxLength: 100,
        },
      });

      const data = JSON.parse((result.content as any)[0].text);
      expect(data.summary.length).toBeLessThanOrEqual(100);
    });
  });

  describe('find_related', () => {
    it('should find related documents', async () => {
      const result = await client.callTool({
        name: 'find_related',
        arguments: {
          dirPath: testProjectPath,
          topic: 'authentication',
        },
      });

      const data = JSON.parse((result.content as any)[0].text);
      expect(data.results).toBeDefined();
      expect(data.results.length).toBeGreaterThan(0);
    });

    it('should respect threshold parameter', async () => {
      const result = await client.callTool({
        name: 'find_related',
        arguments: {
          dirPath: testProjectPath,
          topic: 'authentication',
          threshold: 0.9,
        },
      });

      const data = JSON.parse((result.content as any)[0].text);
      expect(data.threshold).toBe(0.9);
    });
  });

  describe('check_stale', () => {
    it('should detect stale documents', async () => {
      const result = await client.callTool({
        name: 'check_stale',
        arguments: {
          dirPath: testProjectPath,
        },
      });

      const data = JSON.parse((result.content as any)[0].text);
      expect(data.staleDocuments).toBeDefined();
      expect(data.maxAgeDays).toBe(30);
    });

    it('should respect maxAgeDays parameter', async () => {
      const result = await client.callTool({
        name: 'check_stale',
        arguments: {
          dirPath: testProjectPath,
          maxAgeDays: 60,
        },
      });

      const data = JSON.parse((result.content as any)[0].text);
      expect(data.maxAgeDays).toBe(60);
    });
  });

  describe('sync_documentation', () => {
    it('should initiate doc sync', async () => {
      const result = await client.callTool({
        name: 'sync_documentation',
        arguments: {
          dirPath: testProjectPath,
        },
      });

      const data = JSON.parse((result.content as any)[0].text);
      expect(data.message).toContain('Doc sync');
      expect(data.mode).toBe('update');
    });

    it('should respect updateMode parameter', async () => {
      const result = await client.callTool({
        name: 'sync_documentation',
        arguments: {
          dirPath: testProjectPath,
          updateMode: 'create',
        },
      });

      const data = JSON.parse((result.content as any)[0].text);
      expect(data.mode).toBe('create');
    });
  });

  describe('verify_docs', () => {
    it('should validate documentation', async () => {
      const result = await client.callTool({
        name: 'verify_docs',
        arguments: {
          dirPath: testProjectPath,
          docPath: testDocPath,
        },
      });

      const data = JSON.parse((result.content as any)[0].text);
      expect(data.itemsChecked).toBeDefined();
      expect(data.issues).toBeDefined();
    });
  });

  describe('verify_docs with signature validation', () => {
    it('should detect parameter count mismatch', async () => {
      const mismatchDocPath = path.join(testProjectPath, 'docs', 'mismatch.md');
      await fs.writeFile(
        mismatchDocPath,
        `# Mismatch Test\n\nfunction login(username, password, extra) {}\n`
      );

      const result = await client.callTool({
        name: 'verify_docs',
        arguments: {
          dirPath: testProjectPath,
          docPath: mismatchDocPath,
        },
      });

      const data = JSON.parse((result.content as any)[0].text);
      const signatureIssue = data.issues.find((i: any) => i.status === 'signature_mismatch');
      expect(signatureIssue).toBeDefined();
      expect(signatureIssue.suggestion).toContain('Parameter count mismatch');
    });
  });

  describe('get_context', () => {
    it('should provide context for current file', async () => {
      const result = await client.callTool({
        name: 'get_context',
        arguments: {
          dirPath: testProjectPath,
          currentFilePath: path.join(testProjectPath, 'src', 'auth.ts'),
        },
      });

      const data = JSON.parse((result.content as any)[0].text);
      expect(data.relevantDocs).toBeDefined();
      expect(data.relevantDocs.length).toBeGreaterThan(0);
    });

    it('should respect contextDepth parameter', async () => {
      const result = await client.callTool({
        name: 'get_context',
        arguments: {
          dirPath: testProjectPath,
          currentFilePath: path.join(testProjectPath, 'src', 'auth.ts'),
          contextDepth: 'deep',
        },
      });

      const data = JSON.parse((result.content as any)[0].text);
      expect(data.contextDepth).toBe('deep');
    });
  });

  describe('check_delta', () => {
    it('should compare doc with code', async () => {
      const result = await client.callTool({
        name: 'check_delta',
        arguments: {
          dirPath: testProjectPath,
          docPath: testDocPath,
        },
      });

      const data = JSON.parse((result.content as any)[0].text);
      expect(data.deltas).toBeDefined();
      expect(data.itemsCompared).toBeGreaterThan(0);
    });
  });

  describe('show_help', () => {
    it('should provide help for all tools', async () => {
      const result = await client.callTool({
        name: 'show_help',
        arguments: {},
      });

      const data = JSON.parse((result.content as any)[0].text);
      expect(data.tools).toBeDefined();
      expect(Object.keys(data.tools).length).toBeGreaterThan(10);
    });

    it('should provide help for specific tool', async () => {
      const result = await client.callTool({
        name: 'show_help',
        arguments: {
          toolName: 'semantic_search',
        },
      });

      const data = JSON.parse((result.content as any)[0].text);
      expect(data.tool).toBe('semantic_search');
      expect(data.description).toBeDefined();
    });

    it('should return error for unknown tool', async () => {
      const result = await client.callTool({
        name: 'show_help',
        arguments: {
          toolName: 'nonexistent_tool',
        },
      });

      expect((result as any).isError).toBe(true);
    });
  });

  describe('check_artefacts', () => {
    it('should detect artefacts needing updates', async () => {
      const result = await client.callTool({
        name: 'check_artefacts',
        arguments: {
          dirPath: testProjectPath,
        },
      });

      const data = JSON.parse((result.content as any)[0].text);
      expect(data.staleArtefacts).toBeDefined();
      expect(data.priorityMode).toBe('impact');
    });

    it('should respect priorityMode parameter', async () => {
      const result = await client.callTool({
        name: 'check_artefacts',
        arguments: {
          dirPath: testProjectPath,
          priorityMode: 'recency',
        },
      });

      const data = JSON.parse((result.content as any)[0].text);
      expect(data.priorityMode).toBe('recency');
    });
  });

  describe('search_docs with ranking', () => {
    it('should return ranked results', async () => {
      const result = await client.callTool({
        name: 'search_docs',
        arguments: {
          dirPath: testProjectPath,
          pattern: 'authentication',
        },
      });

      const data = JSON.parse((result.content as any)[0].text);
      expect(data.results).toBeDefined();
      expect(data.results[0].relevanceScore).toBeDefined();

      // Check if sorted by score
      if (data.results.length > 1) {
        expect(data.results[0].relevanceScore).toBeGreaterThanOrEqual(
          data.results[1].relevanceScore
        );
      }
    });
  });
});
