// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ReadableStream } from 'node:stream/web';

import { clientId, sessionId } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

export const TakeScreenshot = /*#__PURE__*/ defineTool({
  name: 'Page_takeScreenshot',
  description: 'Take a screenshot of the current page.',
  schema: {
    clientId,
    sessionId,
  },
  annotations: {
    readOnlyHint: true,
  },
  async handler({ params, extra }, response, context) {
    const connector = context.connector();

    const timeoutSignal = AbortSignal.timeout(10_000);
    const signal = extra.signal
      ? AbortSignal.any([extra.signal, timeoutSignal])
      : timeoutSignal;

    await using stream = await connector.sendCDPStream(
      params.clientId,
      ReadableStream.from([
        { method: 'Lynx.getScreenshot', sessionId: params.sessionId },
      ]),
      { signal },
    );

    for await (const { method, params: eventParams } of stream) {
      if (method === 'Lynx.screenshotCaptured') {
        const { data } = eventParams as { data: string };
        if (data) {
          response.attachImage({
            data,
            mimeType: 'image/jpeg',
          });

          if (data.length > 10 * 1024) {
            const tmp = await fs.mkdtemp(
              path.join(tmpdir(), 'lynx-devtool-mcp-'),
            );
            const fileName = `screenshot-Lynx_getScreenshot.jpeg`;
            await fs.writeFile(
              path.join(tmp, fileName),
              Buffer.from(data, 'base64'),
            );
            response.appendLines(`Screenshot saved to ${tmp}/${fileName}`);
          }
          return;
        }
      }
    }

    throw new Error('Failed to capture screenshot');
  },
});
