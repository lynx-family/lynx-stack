// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { ReadableStream } from 'node:stream/web';
import { setTimeout } from 'node:timers/promises';

import * as z from 'zod';

import { clientId, sessionId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

interface ConsoleCallFrame {
  url: string;
  lineNumber: number;
  columnNumber: number;
}

interface ConsoleStackTrace {
  callFrames: ConsoleCallFrame[];
}

interface ConsoleArg {
  value?: unknown;
}

interface ConsoleMessage {
  type: string;
  args: ConsoleArg[];
  stackTrace?: ConsoleStackTrace;
  url?: string;
}

export const ListConsole = /*#__PURE__*/ defineTool({
  name: 'Runtime_listConsole',
  description: 'List all console messages.',
  schema: {
    clientId,
    sessionId,

    offset: z.number().optional().describe(
      'The number of console messages to skip before returning results.',
    ),
    limit: z.number().min(1).max(100).optional().describe(
      'The maximum number of console messages to return.',
    ),
    includeStackTraces: z.boolean().optional().describe(
      'By default, only error messages would contain stack traces. Set this to true to include stack traces for all messages in the output.',
    ),
    level: z.array(z.enum(['log', 'info', 'warning', 'error', 'debug']))
      .optional().describe(
        'The log level to filter messages. Defaults to [\'info\', \'log\', \'warning\', \'error\']',
      ),
  },
  annotations: {
    readOnlyHint: true,
  },
  async handler({ params }, response, context) {
    const connector = context.connector();

    const {
      offset = 0,
      limit = 100,
      includeStackTraces = false,
      level = ['info', 'log', 'warning', 'error'],
    } = params;

    await using stream = await connector.sendCDPStream(
      params.clientId,
      ReadableStream.from([{
        sessionId: params.sessionId,
        method: 'Page.enable',
      }, {
        sessionId: params.sessionId,
        method: 'Runtime.enable',
      }]),
    );

    const messages: ConsoleMessage[] = [];

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

        if (value.method === 'Runtime.consoleAPICalled') {
          messages.push(value.params as ConsoleMessage);
        }
      }
    } finally {
      reader.releaseLock();
    }

    response.appendLines(
      ...messages
        .filter(msg => (level as string[]).includes(msg.type))
        .slice(offset, offset + limit)
        .map(({ args, type, url, stackTrace }) =>
          `- [${type}] ${args.map((i) => i.value).join(' ')} ${
            (includeStackTraces || type === 'error') && stackTrace
              ? stackTrace.callFrames.map((frame) =>
                `\n  - ${frame.url}:${frame.lineNumber}:${frame.columnNumber}`
              ).join(
                '',
              )
              : (url
                ? `(at ${url})`
                : '')
          }`
        ),
    );
  },
});
