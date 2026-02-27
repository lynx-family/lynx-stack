// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineTool } from '../defineTool.ts';

export const ListDevices = /*#__PURE__*/ defineTool({
  name: 'Device_listDevices',
  description: 'List all connected devices',
  schema: {},
  annotations: {
    readOnlyHint: true,
  },
  handler(_, response) {
    response.setIncludeDevices(true);
    return Promise.resolve();
  },
});
