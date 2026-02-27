// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { clientId, nodeId, rect, sessionId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const ScrollIntoViewIfNeeded = /*#__PURE__*/ defineTool({
  name: 'DOM_scrollIntoViewIfNeeded',
  description:
    'Scrolls the specified rect of the given node into view if not already visible.',
  schema: {
    clientId,
    sessionId,
    nodeId,
    rect: rect.describe(
      'The rect to be scrolled into view, relative to the node\'s border box, in CSS pixels. When omitted, center of the node will be used.',
    ).optional(),
  },
  annotations: {
    readOnlyHint: false,
  },
  async handler(
    { params: { clientId, sessionId, nodeId, rect } },
    response,
    context,
  ) {
    const connector = context.connector();

    const result = await connector.sendCDPMessage(
      clientId,
      sessionId,
      'DOM.scrollIntoViewIfNeeded',
      {
        nodeId,
        rect,
      },
    );

    response.appendLines(JSON.stringify(result));
  },
});
