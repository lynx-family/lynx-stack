// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { clientId, sessionId, styleSheetId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const GetStyleSheetText = /*#__PURE__*/ defineTool({
  name: 'CSS_getStyleSheetText',
  description: 'Returns the text content of the stylesheet.',
  schema: {
    clientId,
    sessionId,
    styleSheetId,
  },
  annotations: {
    readOnlyHint: true,
  },
  async handler(
    { params: { clientId, sessionId, styleSheetId } },
    response,
    context,
  ) {
    const connector = context.connector();

    // https://chromedevtools.github.io/devtools-protocol/tot/CSS/#method-getStyleSheetText
    const result = await connector.sendCDPMessage(
      clientId,
      sessionId,
      'CSS.getStyleSheetText',
      {
        styleSheetId,
      },
    );

    response.appendLines(JSON.stringify(result));
  },
});
