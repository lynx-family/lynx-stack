// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineTool } from '../defineTool.ts';

export const ListDevices = /*#__PURE__*/ defineTool({
  name: 'Device_listDevices',
  description: 'List all connected devices.',
  schema: {},
  annotations: {
    readOnlyHint: true,
  },
  async handler(_, response, context) {
    const connector = context.connector();

    const devices = await connector.listDevices();

    response.setIncludeResponseTitle(false);
    response.appendLines(JSON.stringify(
      devices.map(({ id }) => id),
      null,
      2,
    ));
  },
});
