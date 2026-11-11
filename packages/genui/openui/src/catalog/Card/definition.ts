// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { OPENUI_GAP_VALUES } from '../../shared/layout.js';

/** Server-safe OpenUI definition for Card, with a null renderer. */
export const Card = defineComponent({
  name: 'Card',
  props: z.object({
    children: z.array(z.any()),
    variant: z.enum(['card', 'sunk', 'clear']).optional(),
    direction: z.enum(['row', 'column']).optional(),
    wrap: z.boolean().optional(),
    gap: z.enum(OPENUI_GAP_VALUES).optional(),
    align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
    justify: z.enum(['start', 'center', 'end', 'between']).optional(),
  }),
  description:
    'Styled container (card/sunk/clear). Accepts Stack layout parameters.',
  component: () => null,
});
