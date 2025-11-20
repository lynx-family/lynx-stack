// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { clientId, sessionId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const ListScripts = /*#__PURE__*/ defineTool({
  name: 'Debugger_listScripts',
  description:
    'List all parsed scripts. If no scripts found, it means that the page is opened before the DevTool connected. Use `Page_reload` to reload the page and get the scripts again.',
  schema: {
    clientId,
    sessionId,
  },
  annotations: {
    readOnlyHint: true,
  },
  async handler({ params }, response, context) {
    const connector = context.connector();

    const scripts = connector.getSource(params.clientId, params.sessionId);

    response.appendLines(
      ...scripts.map(({ scriptId, url }) =>
        `- scriptId: ${scriptId}, url: ${url}`
      ),
    );
  },
});
