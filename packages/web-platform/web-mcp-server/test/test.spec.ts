import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let client: Client;

beforeAll(async () => {
  client = new Client({
    name: 'test-client',
    version: '1.0.0',
  });

  try {
    await client.connect(
      new StdioClientTransport({
        command: 'node',
        args: [path.join(__dirname, '../dist/index.js')],
      }),
    );
  } catch (err) {
    throw new Error(
      `Failed to connect MCP client: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
});
// now create rsbuild dev server
const reactLynxExampleRoot = path.join(__dirname, '../../../../examples/react');
const rspeedy = spawn('pnpm', ['dev'], {
  cwd: reactLynxExampleRoot,
  stdio: 'ignore',
  shell: true,
});

describe('get_element_hierarchy tool', () => {
  it('should has get_element_hierarchy tool', async () => {
    const tools = (await client.listTools()).tools;
    const tool = tools.find((t) => t.name === 'get_element_hierarchy');
    expect(tool).toBeDefined();
  });

  //   it('should return element hierarchy', async () => {
  //     const result = await client.callTool('get_element_hierarchy', {
  //       url: 'https://lynxjs.github.io/lynx/examples/basic.html',
  //     });
  //   });
});

describe('screenshot tool', () => {
  it('should has get_screenshot tool', async () => {
    const tools = (await client.listTools()).tools;
    const tool = tools.find((t) => t.name === 'get_screenshot');
    expect(tool).toBeDefined();
  });
});

afterAll(() => {
  client.close();
  rspeedy.kill('SIGHUP');
});
