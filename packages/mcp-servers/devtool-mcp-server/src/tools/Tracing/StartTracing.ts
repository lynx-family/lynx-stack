// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { clientId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

type TracingStartResponse = {
  error?: {
    message: string;
  };
};

export const StartTracing = /*#__PURE__*/ defineTool({
  name: 'Tracing_start',
  description: 'Start trace events collection',
  schema: {
    clientId,
  },
  annotations: {
    readOnlyHint: false,
  },
  async handler({ params }, response, context) {
    const connector = context.connector();
    const client = connector.usbClients.get(params.clientId);
    if (client && client.info.query.os === 'Android') {
      const value = await connector.getGlobalSwitch(
        params.clientId,
        'enable_debug_mode',
      );
      if (!value) {
        await connector.setGlobalSwitch(
          params.clientId,
          'enable_debug_mode',
          true,
        );
        response.appendLines(
          'Start Trace failed: Please restart the app to enable tracing functionality.',
        );
        return;
      }
    }
    const config = {
      recordMode: 'recordContinuously',
      includedCategories: ['*'],
      enableSystrace: true,
      bufferSize: 200 * 1024,
      JSProfileInterval: 1,
      enableCompress: true,
    };
    const result = await connector.sendCDPMessage<TracingStartResponse>(
      params.clientId,
      -1,
      'Tracing.start',
      {
        traceConfig: config,
      },
    );

    if (result.error) {
      const msg = result.error.message;

      if (
        msg.indexOf('Failed to get trace controller') >= 0
        || msg.indexOf('Not implemented:') >= 0
        || msg.indexOf('Tracing not enabled') >= 0
        || msg.indexOf('Failed to start tracing') >= 0
      ) {
        response.appendLines(
          'Start Trace failed: Tracing functionality is not supported in the current version. Please integrate the Lynx development version (with -dev suffix) to enable tracing. For more information, visit: https://lynxjs.org/en/guide/start/integrate-lynx-dev-version.html',
        );
      } else if (msg.indexOf('Tracing already started') >= 0) {
        response.appendLines('Start Trace success');
      } else {
        response.appendLines('Start Trace failed: Trace command error');
      }
    } else {
      response.appendLines('Start Trace success');
    }
  },
});
