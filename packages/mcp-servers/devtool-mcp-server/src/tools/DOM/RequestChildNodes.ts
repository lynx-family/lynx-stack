// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  clientId,
  depth,
  nodeId,
  pierce,
  sessionId,
} from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const RequestChildNodes = /*#__PURE__*/ defineTool({
  name: 'DOM_requestChildNodes',
  description: 'Request child nodes for a given parent node.',
  schema: {
    clientId,
    sessionId,
    nodeId,
    depth,
    pierce,
  },
  annotations: {
    readOnlyHint: true,
  },
  async handler(
    { params: { clientId, sessionId, nodeId, depth, pierce } },
    response,
    context,
  ) {
    const connector = context.connector();

    const result = await connector.sendCDPMessage(
      clientId,
      sessionId,
      'DOM.requestChildNodes',
      {
        nodeId,
        depth,
        pierce,
      },
    );

    response.appendLines(JSON.stringify(result));
  },
});
