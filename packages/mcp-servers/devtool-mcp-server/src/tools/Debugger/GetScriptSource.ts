// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as z from 'zod';
import { clientId, scriptId, sessionId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const GetScriptSource = /*#__PURE__*/ defineTool({
  name: 'Debugger_getScriptSource',
  description:
    'Get the source code of a script identified by the given script identifier. Use `saveToTmp` if the response is too large.',
  schema: {
    clientId,
    sessionId,

    scriptId,
    saveToTmp: z.boolean()
      .optional()
      .describe(
        'Whether to save the script source to a temporary file if it is large.',
      )
      .default(false),
  },
  annotations: {
    readOnlyHint: true,
  },
  async handler({ params }, response, context) {
    const connector = context.connector();

    const { scriptSource } = await connector.sendCDPMessage<
      { scriptSource: string }
    >(
      params.clientId,
      params.sessionId,
      'Debugger.getScriptSource',
      { scriptId: params.scriptId },
    );

    if (params.saveToTmp) {
      const tmp = await fs.mkdtemp(path.join(tmpdir(), 'lynx-devtool-mcp-'));
      await fs.writeFile(
        path.join(tmp, `${params.scriptId}.js`),
        scriptSource,
      );
      response.appendLines(`Script saved to ${tmp}/${params.scriptId}.js`);
    } else {
      response.appendLines('```javascript');
      response.appendLines(scriptSource);
      response.appendLines('```');
    }
  },
});
