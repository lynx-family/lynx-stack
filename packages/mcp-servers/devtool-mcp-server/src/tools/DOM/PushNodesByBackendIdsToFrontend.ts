// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { backendNodeIds, clientId, sessionId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const PushNodesByBackendIdsToFrontend = /*#__PURE__*/ defineTool({
  name: 'DOM_pushNodesByBackendIdsToFrontend',
  description: 'Push backend node IDs to the frontend for inspection.',
  schema: {
    clientId,
    sessionId,
    backendNodeIds,
  },
  annotations: {
    readOnlyHint: true,
  },
  async handler(
    { params: { clientId, sessionId, backendNodeIds } },
    response,
    context,
  ) {
    const connector = context.connector();

    const result = await connector.sendCDPMessage(
      clientId,
      sessionId,
      'DOM.pushNodesByBackendIdsToFrontend',
      {
        backendNodeIds,
      },
    );

    response.appendLines(JSON.stringify(result));
  },
});
