// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { clientId, nodeId, sessionId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const GetAttributes = /*#__PURE__*/ defineTool({
  name: 'DOM_getAttributes',
  description: 'Get all attributes of the specified node.',
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
      'DOM.getAttributes',
      {
        nodeId,
      },
    );

    response.appendLines(JSON.stringify(result));
  },
});
