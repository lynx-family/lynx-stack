// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { deviceId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const ListClients = /*#__PURE__*/ defineTool({
  name: 'Device_listClients',
  description: 'List all connected clients.',
  schema: {
    deviceId,
  },
  annotations: {
    readOnlyHint: true,
  },
  handler({ params }, response) {
    response.setIncludeClients(true, params.deviceId);
    return Promise.resolve();
  },
});
