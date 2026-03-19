// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { ReadableStream } from 'node:stream/web';
import { setTimeout } from 'node:timers/promises';

import { clientId, sessionId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const ListScripts = /*#__PURE__*/ defineTool({
  name: 'Debugger_listScripts',
  description:
    'List all parsed scripts. If no scripts found, it means that the page is opened before the DevTool connected. Use `Page_reload` to reload the page and get the scripts again.',
  schema: {
    clientId,
    sessionId,
  },
  annotations: {
    readOnlyHint: true,
  },
  async handler({ params, extra }, response, context) {
    const connector = context.connector();

    await using stream = await connector.sendCDPStream(
      params.clientId,
      ReadableStream.from([{
        sessionId: params.sessionId,
        method: 'Debugger.enable',
      }]),
      { signal: extra.signal },
    );

    const scripts: { scriptId: string; url: string }[] = [];

    const reader = stream.getReader();
    const IDLE_TIMEOUT = 200;
    const MAX_TOTAL_TIME = 2000;
    const startTime = Date.now();

    try {
      while (Date.now() - startTime < MAX_TOTAL_TIME) {
        const result = await Promise.race([
          reader.read(),
          setTimeout(IDLE_TIMEOUT, 'timeout' as const),
        ]);
        if (result === 'timeout') {
          await reader.cancel();
          break;
        }

        const { done, value } = result;
        if (done) break;

        if (value.method === 'Debugger.scriptParsed') {
          scripts.push(value.params as never);
        }
      }
    } finally {
      reader.releaseLock();
    }

    response.appendLines(
      ...scripts.map(({ scriptId, url }) =>
        `- scriptId: ${scriptId}, url: ${url}`
      ),
    );
  },
});
