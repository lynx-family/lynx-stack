// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { clientId, sessionId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const GetDocumentWithBoxModel = /*#__PURE__*/ defineTool({
  name: 'DOM_getDocumentWithBoxModel',
  description:
    'Get the document tree of the Lynx page with box model information.',
  schema: {
    clientId,
    sessionId,
  },
  annotations: {
    readOnlyHint: true,
  },
  async handler({ params: { clientId, sessionId } }, response, context) {
    const connector = context.connector();

    await connector.sendCDPMessage(clientId, sessionId, 'DOM.enable', {
      useCompression: false,
    });

    const result = await connector.sendCDPMessage(
      clientId,
      sessionId,
      'DOM.getDocumentWithBoxModel',
    );

    response.appendLines(JSON.stringify(result));
  },
});
