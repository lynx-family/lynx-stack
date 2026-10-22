// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { actionPropSchema } from '../Action/schema.js';

/** Server-safe OpenUI definition for a programmable Web Canvas 2D surface. */
export const Canvas = defineComponent({
  name: 'Canvas',
  props: z.object({
    code: z.union([z.string(), z.array(z.string())]).describe(
      'Drawing code using ctx (CanvasRenderingContext2D), width and height. A string runs after streaming ends. For progressive drawing, emit an array of independently executable strings in drawing order. While streaming, the last array item is buffered until another item arrives or streaming ends. Append-only updates execute only new chunks; changing an earlier chunk resets and replays the drawing. Each chunk has its own JavaScript scope; only the canvas and ctx state persist. Use standard ctx drawing commands only; do not access canvas, acquire a context or register events.',
    ),
    width: z.number().int().min(1).max(2048).optional().describe(
      'Logical drawing width in pixels. Defaults to 360.',
    ),
    height: z.number().int().min(1).max(2048).optional().describe(
      'Logical drawing height in pixels. Defaults to 360.',
    ),
    name: z.string().optional().describe(
      'Canvas element name. With action, receives the clicked logical { x, y } coordinates before the action runs; use a $state name for reactive binding.',
    ),
    action: actionPropSchema.optional().describe(
      'Action to execute on click, after updating name with logical coordinates. Disabled while streaming.',
    ),
  }),
  description:
    'Web Canvas 2D surface rendered with standard ctx drawing commands. Update code to redraw; the component manages canvas initialization. Non-Web hosts display an unsupported message unless they override this component.',
  component: () => null,
});
