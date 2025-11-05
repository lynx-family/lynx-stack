// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { DebugRouterConnector } from '@lynx-js/debug-router-connector';
import * as z from 'zod';
import { clientId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const OpenPage = /*#__PURE__*/ defineTool({
  name: 'Device_openPage',
  description: 'Open a Lynx page',
  schema: {
    url: z.string().describe('The URL of the Lynx page'),
    clientId: clientId.optional(),
  },
  annotations: {
    readOnlyHint: false,
  },
  async handler({ params }, _, context) {
    const connector = context.connector();

    const clients = params.clientId
      ? [connector.usbClients.get(params.clientId)!]
      : connector.getAllUsbClients();

    if (clients.length === 0) {
      throw new Error('No Lynx client found');
    }

    for (const client of clients) {
      if (
        params.url.startsWith('http://') || params.url.startsWith('https://')
      ) {
        // This is used to open URL in LynxExplorer, which does not support `App.openPage`.
        open(connector, client.clientId(), params.url);
      } else {
        await client.sendClientMessage('App.openPage', {
          url: params.url,
        });
      }
    }
  },
});

function open(
  connector: DebugRouterConnector,
  clientId: number,
  url: string,
) {
  connector.sendMessageToApp(
    clientId,
    JSON.stringify({
      event: 'Customized',
      data: {
        type: 'OpenCard',
        data: {
          type: 'url',
          url: url,
        },
        sender: clientId,
      },
      from: clientId,
    }),
  );
}
