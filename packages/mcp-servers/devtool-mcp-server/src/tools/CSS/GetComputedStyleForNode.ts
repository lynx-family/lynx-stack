// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { clientId, nodeId, sessionId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const GetComputedStyleForNode = /*#__PURE__*/ defineTool({
  name: 'CSS_getComputedStyleForNode',
  description:
    'Returns the computed style for a DOM node identified by nodeId.',
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

    // https://chromedevtools.github.io/devtools-protocol/tot/CSS/#method-getComputedStyleForNode
    const result = await connector.sendCDPMessage(
      clientId,
      sessionId,
      'CSS.getComputedStyleForNode',
      {
        nodeId,
      },
    );

    response.appendLines(JSON.stringify(result));
  },
});
