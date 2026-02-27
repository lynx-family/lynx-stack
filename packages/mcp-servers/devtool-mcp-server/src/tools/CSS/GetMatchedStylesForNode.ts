// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { clientId, nodeId, sessionId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const GetMatchedStylesForNode = /*#__PURE__*/ defineTool({
  name: 'CSS_getMatchedStylesForNode',
  description:
    'Returns CSS rules matching the specified node. The matchedCSSRules in the result are ordered by priority from high to low. When selectors have the same specificity, rules that appear later (further down) have higher priority.',
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

    // https://chromedevtools.github.io/devtools-protocol/tot/CSS/#method-getMatchedStylesForNode
    const result = await connector.sendCDPMessage(
      clientId,
      sessionId,
      'CSS.getMatchedStylesForNode',
      {
        nodeId,
      },
    );

    response.appendLines(JSON.stringify(result));
  },
});
