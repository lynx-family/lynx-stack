// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { clientId, nodeId, sessionId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const GetBoxModel = /*#__PURE__*/ defineTool({
  name: 'DOM_getBoxModel',
  description: 'Get the document model of a Lynx element.',
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

    // https://chromedevtools.github.io/devtools-protocol/tot/DOM/#method-getBoxModel
    const box = await connector.sendCDPMessage(
      clientId,
      sessionId,
      'DOM.getBoxModel',
      {
        nodeId,
      },
    );

    response.appendLines(JSON.stringify(box));
  },
});
