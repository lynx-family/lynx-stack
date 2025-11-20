// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as z from 'zod';
import { clientId, sessionId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

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
      limit = Number.POSITIVE_INFINITY,
      includeStackTraces = false,
      level = ['info', 'log', 'warning', 'error'],
    } = params;

    const consoleMessages = connector.getConsole(
      params.clientId,
      params.sessionId,
    );

    response.appendLines(
      ...consoleMessages
        .slice(offset, offset + limit)
        .filter(msg => level.includes(msg.type))
        .map(({ args, type, url, stackTrace }) =>
          `- [${type}] ${args.map(i => i.value).join(' ')} ${
            (includeStackTraces || type === 'error')
              ? stackTrace.callFrames.map(frame =>
                `\n  - ${frame.url}:${frame.lineNumber}:${frame.columnNumber}`
              ).join(
                '',
              )
              : `(at ${url})`
          }`
        ),
    );
  },
});
