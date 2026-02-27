// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as z from 'zod';

export const clientId = z
  .number()
  .describe(
    'The clientId to list sessions. Use `Device_listClients` to get the ID.',
  );

export const deviceId = z.string()
  .optional()
  .describe(
    'The deviceId. Use the `Device_listDevices` to get ID for a devices. Omit to get all clients.',
  );

// https://chromedevtools.github.io/devtools-protocol/tot/DOM/#type-NodeId
export const nodeId = z.number()
  .describe('Identifier of the node. Unique DOM node identifier.');

export const sessionId = z
  .number()
  .describe(
    'The sessionId to list sessions. Use `Device_listSessions` to get the ID.',
  );

export const selector = z.string()
  .describe('CSS selector string');

export const query = z.string()
  .describe('Search query string');

export const searchId = z.number()
  .describe('Search identifier');

export const fromIndex = z.number()
  .describe('Start index for search results');

export const toIndex = z.number()
  .describe('End index for search results');

export const x = z.number()
  .describe('X coordinate');

export const y = z.number()
  .describe('Y coordinate');

export const depth = z.number()
  .optional()
  .describe('Depth of child nodes to retrieve');

export const pierce = z.boolean()
  .optional()
  .describe('Whether to pierce through shadow DOM');

export const backendNodeIds = z.array(z.number())
  .describe('Array of backend node IDs');

export const includeUserAgentShadowDOM = z.boolean()
  .optional()
  .describe('Whether to include user agent shadow DOM in search');

// https://chromedevtools.github.io/devtools-protocol/tot/CSS/#type-StyleSheetId
export const styleSheetId = z.string()
  .describe('Style sheet identifier');

// https://chromedevtools.github.io/devtools-protocol/tot/DOM/#type-Rect
export const rect = z.object({
  x,
  y,
  width: z.number().describe('Width of the rectangle'),
  height: z.number().describe('Height of the rectangle'),
});

export const scriptId = z.string()
  .describe(
    'Identifier of the script. Use `Debugger_listScripts` to get the script IDs of a session.',
  );
