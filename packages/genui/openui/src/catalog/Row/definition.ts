// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { OPENUI_GAP_VALUES } from '../../shared/layout.js';

const rowPropsSchema = z.object({
  children: z.array(z.any()),
  justify: z.enum([
    'start',
    'center',
    'end',
    'between',
    'around',
    'evenly',
    'spaceBetween',
    'spaceAround',
    'spaceEvenly',
    'stretch',
  ]).optional(),
  align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
  gap: z.enum(OPENUI_GAP_VALUES).optional(),
  wrap: z.boolean().optional(),
});

/** Server-safe OpenUI definition for Row, with a null renderer. */
export const Row = defineComponent({
  name: 'Row',
  props: rowPropsSchema,
  description: 'Horizontal flex layout container.',
  component: () => null,
});
