// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { clientId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const ClosePage = /*#__PURE__*/ defineTool({
  name: 'Device_closePage',
  description: 'Close the current page',
  schema: {
    clientId,
  },
  annotations: {
    readOnlyHint: false,
  },
  async handler({ params }, _, context) {
    const connector = context.connector();

    await connector.sendAppMessage(params.clientId, 'App.closePage');
  },
});
