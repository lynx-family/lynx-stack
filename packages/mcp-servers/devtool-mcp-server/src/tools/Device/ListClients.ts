// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { deviceId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const ListClients = /*#__PURE__*/ defineTool({
  name: 'Device_listClients',
  description:
    'List all connected clients. This tool may timeout if no clients are connected or just started. Use `Devices_reconnect` and retry in a few seconds if that happens.',
  schema: {
    deviceId,
  },
  annotations: {
    readOnlyHint: true,
  },
  async handler({ params }, response, context) {
    const connector = context.connector();
    response.setIncludeClients(true, params.deviceId);

    if (connector.usbClients.size > 0) {
      return;
    }

    // Wait until client connected
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    connector.on('client-connected', onClientConnected);
    setTimeout(() => {
      connector.off('client-connected', onClientConnected);
      reject(
        new Error(
          'List clients timeout. Please open App with Lynx Engine and try again.',
        ),
      );
    }, 1000);
    function onClientConnected() {
      connector.off('client-connected', onClientConnected);
      resolve();
    }

    return promise;
  },
});
