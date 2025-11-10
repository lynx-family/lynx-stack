// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  clientId,
  fromIndex,
  searchId,
  sessionId,
  toIndex,
} from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const GetSearchResults = /*#__PURE__*/ defineTool({
  name: 'DOM_getSearchResults',
  description: 'Get search results for the specified range.',
  schema: {
    clientId,
    sessionId,
    searchId,
    fromIndex,
    toIndex,
  },
  annotations: {
    readOnlyHint: true,
  },
  async handler(
    { params: { clientId, sessionId, searchId, fromIndex, toIndex } },
    response,
    context,
  ) {
    const connector = context.connector();

    const result = await connector.sendCDPMessage(
      clientId,
      sessionId,
      'DOM.getSearchResults',
      {
        searchId,
        fromIndex,
        toIndex,
      },
    );

    response.appendLines(JSON.stringify(result));
  },
});
