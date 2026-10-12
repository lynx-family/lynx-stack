// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { OPENUI_GAP_VALUES } from '../../shared/layout.js';

/** Server-safe OpenUI definition for Stack, with a null renderer. */
export const Stack = defineComponent({
  name: 'Stack',
  props: z.object({
    children: z.array(z.any()),
    direction: z.enum(['row', 'column']).optional(),
    wrap: z.boolean().optional(),
    gap: z.enum(OPENUI_GAP_VALUES).optional(),
    align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
    justify: z.enum(['start', 'center', 'end', 'between']).optional(),
  }),
  description: 'Flex layout container.',
  component: () => null,
});
