// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { clientId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';
import * as z from 'zod';

export const StartTracing = /*#__PURE__*/ defineTool({
  name: 'Tracing_start',
  description: 'Start trace events collection',
  schema: {
    clientId,
    JSProfileType: z.enum(['quickjs', 'v8']).default('quickjs').describe(
      'JavaScript profile type: quickjs or v8. Use quickjs in most cases, unless you explicitly need v8.',
    ),
    enableSystrace: z.boolean().default(true).describe(
      'Whether to enable systrace. Defaults to true, unless explicitly set to false.',
    ),
    JSProfileInterval: z.number().default(100).describe(
      'JavaScript profile interval in milliseconds. Set to -1 to disable JavaScript profiling.',
    ),
  },
  annotations: {
    readOnlyHint: false,
  },
  async handler({ params }, response, context) {
    const connector = context.connector();
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const timer = setTimeout(() => {
      reject(new Error('Start Trace timeout, please restart your app'));
    }, 8000);
    const cleanup = () => {
      clearTimeout(timer);
    };
    const client = connector.usbClients.get(params.clientId);

    // Immediately return the promise and handle async operations in the background
    (async () => {
      try {
        if (client?.info.query.os === 'Android') {
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
            cleanup();
            reject(
              new Error(
                'Please restart the app to enable tracing functionality.',
              ),
            );
            return;
          }
        }

        const config = {
          recordMode: 'recordContinuously',
          includedCategories: ['*'],
          excludedCategories: ['*'],
          enableSystrace: params.enableSystrace,
          bufferSize: 200 * 1024,
          JSProfileInterval: params.JSProfileInterval,
          JSProfileType: params.JSProfileType,
          enableCompress: true,
        };
        await connector.sendCDPMessage(
          params.clientId,
          -1,
          'Tracing.start',
          {
            traceConfig: config,
          },
        );
        response.appendLines('Start Trace success');
        resolve();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (
          msg.includes('Failed to get trace controller')
          || msg.includes('Not implemented:')
          || msg.includes('Tracing not enabled')
          || msg.includes('Failed to start tracing')
        ) {
          reject(
            new Error(
              'Tracing functionality is not supported in the current version. Please integrate the Lynx development version (with -dev suffix) to enable tracing. For more information, visit: https://lynxjs.org/en/guide/start/integrate-lynx-dev-version.html',
            ),
          );
        } else {
          reject(
            new Error(
              `Trace command error: ${msg}`,
            ),
          );
        }
      } finally {
        cleanup();
      }
    })();

    return promise;
  },
});
