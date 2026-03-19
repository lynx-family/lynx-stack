// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import 'core-js/modules/es.promise.with-resolvers.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { Connector } from '@lynx-js/devtool-connector';
import {
  AndroidTransport,
  DesktopTransport,
  iOSTransport,
} from '@lynx-js/devtool-connector/transport';
import type { Transport } from '@lynx-js/devtool-connector/transport';

import { McpContext } from './McpContext.ts';
import { McpResponse } from './McpResponse.ts';
import { GetBackgroundColors } from './tools/CSS/GetBackgroundColors.ts';
import { GetComputedStyleForNode } from './tools/CSS/GetComputedStyleForNode.ts';
import { GetInlineStylesForNode } from './tools/CSS/GetInlineStylesForNode.ts';
import { GetMatchedStylesForNode } from './tools/CSS/GetMatchedStylesForNode.ts';
import { GetStyleSheetText } from './tools/CSS/GetStyleSheetText.ts';
import { GetScriptSource } from './tools/Debugger/GetScriptSource.ts';
import { ListScripts } from './tools/Debugger/ListScripts.ts';
import type { ToolDefinition } from './tools/defineTool.ts';
import { ClosePage } from './tools/Device/ClosePage.ts';
import { ListClients } from './tools/Device/ListClients.ts';
import { ListDevices } from './tools/Device/ListDevices.ts';
import { ListSessions } from './tools/Device/ListSessions.ts';
import { OpenPage } from './tools/Device/OpenPage.ts';
import { GetAttributes } from './tools/DOM/GetAttributes.ts';
import { GetBoxModel } from './tools/DOM/GetBoxModel.ts';
import { GetDocument } from './tools/DOM/GetDocument.ts';
import { GetDocumentWithBoxModel } from './tools/DOM/GetDocumentWithBoxModel.ts';
import { GetNodeForLocation } from './tools/DOM/GetNodeForLocation.ts';
import { GetOriginalNodeIndex } from './tools/DOM/GetOriginalNodeIndex.ts';
import { GetSearchResults } from './tools/DOM/GetSearchResults.ts';
import { InnerText } from './tools/DOM/InnerText.ts';
import { PerformSearch } from './tools/DOM/PerformSearch.ts';
import { PushNodesByBackendIdsToFrontend } from './tools/DOM/PushNodesByBackendIdsToFrontend.ts';
import { QuerySelector } from './tools/DOM/QuerySelector.ts';
import { QuerySelectorAll } from './tools/DOM/QuerySelectorAll.ts';
import { RequestChildNodes } from './tools/DOM/RequestChildNodes.ts';
import { ScrollIntoViewIfNeeded } from './tools/DOM/ScrollIntoViewIfNeeded.ts';
import { EmulateTouchFromMouseEvent } from './tools/Input/EmulateTouchFromMouseEvent.ts';
import { Reload } from './tools/Page/Reload.ts';
import { TakeScreenshot } from './tools/Page/TakeScreenshot.ts';
import { ListConsole } from './tools/Runtime/ListConsole.ts';

const TOOLS = [
  // CSS
  GetBackgroundColors,
  GetComputedStyleForNode,
  GetInlineStylesForNode,
  GetMatchedStylesForNode,
  GetStyleSheetText,

  // Debugger
  GetScriptSource,
  ListScripts,

  // Device
  ClosePage,
  ListClients,
  ListDevices,
  ListSessions,
  OpenPage,

  // DOM
  GetAttributes,
  GetBoxModel,
  GetDocument,
  GetDocumentWithBoxModel,
  GetNodeForLocation,
  GetOriginalNodeIndex,
  GetSearchResults,
  InnerText,
  PerformSearch,
  PushNodesByBackendIdsToFrontend,
  QuerySelector,
  QuerySelectorAll,
  RequestChildNodes,
  ScrollIntoViewIfNeeded,

  // Page
  Reload,
  TakeScreenshot,

  // Input
  EmulateTouchFromMouseEvent,

  // Runtime
  ListConsole,
] as unknown as ToolDefinition[];

export function registerTool(
  mcpServer: McpServer,
  tool: ToolDefinition,
  transports: Transport[],
): void {
  if (!tool.schema) {
    throw new Error('Tool schema is required');
  }
  mcpServer.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: tool.schema,
      annotations: tool.annotations,
    },
    async (params, extra): Promise<CallToolResult> => {
      const response = new McpResponse();
      const connector = new Connector(transports);
      const context = await McpContext.withConnector(connector);
      try {
        await tool.handler({ params, extra }, response, context);
        const content = await response.handle(tool.name);

        return { content };
      } catch (error) {
        const errorText = error instanceof Error
          ? error.message
          : String(error);

        return {
          isError: true,
          content: [
            { type: 'text', text: errorText },
          ],
        };
      }
    },
  );
}

export function setupServer(
  mcpServer: McpServer,
  transports?: Transport[],
): void {
  for (const tool of TOOLS) {
    registerTool(mcpServer, tool, transports ?? createDefaultTransports());
  }

  return;
}

function createDefaultTransports(): Transport[] {
  return [
    new iOSTransport(),
    new AndroidTransport({
      host: '127.0.0.1', // Node.js 18 does not support ::1
      port: 5037,
    }),
    new DesktopTransport(),
  ];
}

// TODO: export from '@lynx-js/devtool-mcp-server/transport'
export {
  AndroidTransport,
  DesktopTransport,
  iOSTransport,
} from '@lynx-js/devtool-connector/transport';
export type { Transport } from '@lynx-js/devtool-connector/transport';

export * as Schema from './schema/index.ts';
export { defineTool, type ToolDefinition } from './tools/defineTool.ts';
