// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { clientId, nodeId, sessionId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const GetOriginalNodeIndex = /*#__PURE__*/ defineTool({
  name: 'DOM_getOriginalNodeIndex',
  description: 'Get the original index of the node in its parent.',
  schema: {
    clientId,
    sessionId,
    nodeId,
  },
  annotations: {
    readOnlyHint: true,
  },
  async handler(
    { params: { clientId, sessionId, nodeId } },
    response,
    context,
  ) {
    const connector = context.connector();

    const result = await connector.sendCDPMessage(
      clientId,
      sessionId,
      'DOM.getOriginalNodeIndex',
      {
        nodeId,
      },
    );

    response.appendLines(JSON.stringify(result));
  },
});
