#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import packageJson from '../package.json' assert { type: 'json' };
import { createPuppeteerPage } from './createPuppeteer.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'Lynx Web Platform MCP Server',
  version: packageJson.version,
});

server.registerTool(
  'get_screenshot',
  {
    title: 'Get Screenshot',
    description: 'run a lynx bundle on web platform and get a screenshot. ',
    inputSchema: {
      url: z.string().describe('The web preview URL of the current Lynx Page'),
    },
  },
  async ({ url }) => {
    const page = await createPuppeteerPage(url);
    try {
      const screenshot = await page.screenshot({ encoding: 'base64' });
      return {
        content: [{
          type: 'image',
          mimeType: 'image/png',
          data: screenshot,
        }],
      };
    } finally {
      await page.close();
    }
  },
);

server.registerTool(
  'get_element_hierarchy',
  {
    title: 'Get Element Hierarchy',
    description:
      'run a lynx bundle on web platform and get the element hierarchy. Note that the style attributes are not included. ',
    inputSchema: {
      url: z.string().describe('The web preview URL of the Lynx page'),
    },
  },
  async ({ url }) => {
    const page = await createPuppeteerPage(url);
    // Get the element hierarchy as JSON
    try {
      // Get the element hierarchy as JSON
      const result = await page.evaluate(() => {
        const lynxView = document.querySelector('lynx-view');
        const rootElement = lynxView?.shadowRoot?.querySelector(
          '[lynx-tag="page"]',
        );
        if (!rootElement) return null;
        type ElementHierarchy = {
          tag: string | null;
          children: ElementHierarchy[];
          attributes: Record<string, string>;
        };
        function getElementHierarchy(element: Element): ElementHierarchy {
          const tag = element.getAttribute('lynx-tag');
          const children = Array.from(element.children).map(child =>
            getElementHierarchy(child)
          );
          const attributes = Object.fromEntries(
            Array.from(element.attributes).filter((attr) =>
              !attr.name.startsWith('l-') && attr.name !== 'lynx-tag'
              && attr.name !== 'style'
            ).map(attr => [attr.name, attr.value]),
          );
          return { tag, attributes, children };
        }
        return getElementHierarchy(rootElement);
      });
      return {
        content: [{
          type: 'text',
          mimeType: 'application/json',
          text: JSON.stringify(result, null, 2),
        }],
      };
    } finally {
      await page.close();
    }
  },
);

async function main() {
  const transport: StdioServerTransport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Lynx Web Platform MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
