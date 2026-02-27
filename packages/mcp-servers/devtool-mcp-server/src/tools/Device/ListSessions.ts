// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { clientId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const ListSessions = /*#__PURE__*/ defineTool({
  name: 'Device_listSessions',
  description: 'List all opened Lynx pages',
  schema: {
    clientId,
  },
  annotations: {
    readOnlyHint: true,
  },
  async handler({ params }, response, context) {
    const connector = context.connector();

    const sessions = await connector.sendSessionListMessage(params.clientId);

    response.appendLines(JSON.stringify(sessions));
  },
});
