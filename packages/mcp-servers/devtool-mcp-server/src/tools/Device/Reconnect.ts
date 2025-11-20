// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { reconnect } from '../../connector.ts';
import { defineTool } from '../defineTool.ts';

export const Reconnect = /*#__PURE__*/ defineTool({
  name: 'Device_reconnect',
  description:
    'Reconnect all devices. This may be useful when no device or client found.',
  schema: {},
  annotations: {
    readOnlyHint: true,
  },
  async handler(_, response) {
    await reconnect();

    response.setIncludeDevices(true);
    response.setIncludeClients(true);
  },
});
