// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as z from 'zod';
import { clientId, sessionId, x, y } from '../../schema/index.ts';
import { defineTool } from '../defineTool.ts';

const type = z.enum(['mousePressed', 'mouseReleased', 'mouseMoved']).describe(
  'Type of mouse event',
);
const timestamp = z.number().describe('Timestamp of the mouse event');
const button = z.enum(['left', 'middle', 'right']).describe('Mouse button');
const deltaX = z.number().optional().describe(
  'Horizontal scroll delta (optional)',
);
const deltaY = z.number().optional().describe(
  'Vertical scroll delta (optional)',
);

export const EmulateTouchFromMouseEvent = defineTool({
  name: 'Input_emulateTouchFromMouseEvent',
  description:
    'Emulate touch from mouse event - converts mouse events to touch events for testing touch interactions',
  annotations: {
    readOnlyHint: false,
  },
  schema: {
    clientId,
    sessionId,
    type,
    x,
    y,
    timestamp,
    button,
    deltaX,
    deltaY,
  },
  async handler(
    {
      params: {
        clientId,
        sessionId,
        type,
        x,
        y,
        timestamp,
        button,
        deltaX,
        deltaY,
      },
    },
    response,
    context,
  ) {
    const connector = context.connector();

    const result = await connector.sendCDPMessage(
      clientId,
      sessionId,
      'Input.emulateTouchFromMouseEvent',
      {
        type,
        x,
        y,
        timestamp,
        button,
        deltaX,
        deltaY,
      },
    );

    response.appendLines(JSON.stringify(result));
  },
});
