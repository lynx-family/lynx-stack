// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { clientId, nodeId, selector, sessionId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const QuerySelector = /*#__PURE__*/ defineTool({
  name: 'DOM_querySelector',
  description: 'Find the first element matching the CSS selector.',
  schema: {
    clientId,
    sessionId,
    nodeId: nodeId.optional().describe(
      'Identifier of the node. Unique DOM node identifier. Defaults to root node if not specified.',
    ),
    selector,
  },
  annotations: {
    readOnlyHint: true,
  },
  async handler(
    { params: { clientId, sessionId, nodeId, selector } },
    response,
    context,
  ) {
    const connector = context.connector();

    const result = await connector.sendCDPMessage(
      clientId,
      sessionId,
      'DOM.querySelector',
      {
        nodeId,
        selector,
      },
    );

    response.appendLines(JSON.stringify(result));
  },
});
