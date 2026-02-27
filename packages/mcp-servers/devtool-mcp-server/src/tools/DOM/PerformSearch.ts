// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  clientId,
  includeUserAgentShadowDOM,
  query,
  sessionId,
} from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const PerformSearch = /*#__PURE__*/ defineTool({
  name: 'DOM_performSearch',
  description: 'Search for nodes in the DOM tree.',
  schema: {
    clientId,
    sessionId,
    query,
    includeUserAgentShadowDOM,
  },
  annotations: {
    readOnlyHint: true,
  },
  async handler(
    { params: { clientId, sessionId, query, includeUserAgentShadowDOM } },
    response,
    context,
  ) {
    const connector = context.connector();

    const result = await connector.sendCDPMessage(
      clientId,
      sessionId,
      'DOM.performSearch',
      {
        query,
        includeUserAgentShadowDOM,
      },
    );

    response.appendLines(JSON.stringify(result));
  },
});
