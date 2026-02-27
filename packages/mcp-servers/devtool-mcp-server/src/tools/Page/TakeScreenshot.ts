// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
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
  async handler({ params }, response, context) {
    const connector = context.connector();

    await connector.sendCDPMessage(
      params.clientId,
      params.sessionId,
      'Page.startScreencast',
      {
        'format': 'jpeg',
        'quality': 20,
        'mode': 'fullscreen',
      },
    );

    interface Response {
      data: string;
      metadata: {
        deviceHeight: number;
        deviceWidth: number;
        offsetTop: number;
        pageScaleFactor: number;
        scrollOffsetX: number;
        scrollOffsetY: number;
        timestamp: number;
      };
    }

    const { data, metadata } = await connector.waitForCDPEvent<Response>(
      'Page.screencastFrame',
    );

    response.appendLines(JSON.stringify(metadata));
    response.attachImage({
      data,
      mimeType: 'image/jpeg',
    });

    if (data.length > 10 * 1024) {
      const tmp = await fs.mkdtemp(path.join(tmpdir(), 'lynx-devtool-mcp-'));
      await fs.writeFile(
        path.join(tmp, 'screenshot.jpeg'),
        Buffer.from(data, 'base64'),
      );
      response.appendLines(`Screenshot saved to ${tmp}/screenshot.jpeg`);
    }

    await connector.sendCDPMessage(
      params.clientId,
      params.sessionId,
      'Page.stopScreencast',
    );
  },
});
