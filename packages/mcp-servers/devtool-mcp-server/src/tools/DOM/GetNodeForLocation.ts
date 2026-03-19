// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { clientId, sessionId, x, y } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const GetNodeForLocation = /*#__PURE__*/ defineTool({
  name: 'DOM_getNodeForLocation',
  description: 'Get the node at the specified coordinates.',
  schema: {
    clientId,
    sessionId,
    x,
    y,
  },
  annotations: {
    readOnlyHint: true,
  },
  async handler({ params: { clientId, sessionId, x, y } }, response, context) {
    const connector = context.connector();

    const result = await connector.sendCDPMessage(
      clientId,
      sessionId,
      'DOM.getNodeForLocation',
      {
        x,
        y,
      },
    );

    response.appendLines(JSON.stringify(result));
  },
});
