// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { actionPropSchema } from '../../catalog/Action/schema.js';
import { CompositeCardItem } from '../CompositeCardItem/definition.js';

/** Server-safe CompositeCardBlock component contract. */
export const CompositeCardBlock = defineComponent({
  name: 'CompositeCardBlock',
  props: z.object({
    items: z.array(CompositeCardItem.ref).min(2),
    layout: z.enum(['grid', 'carousel']).default('grid'),
    responsive: z.boolean().default(true),
    action: actionPropSchema.optional(),
    gap: z.union([z.number(), z.string()]).optional(),
  }),
  description:
    'Two or more rich cards in a grid or carousel, with an optional shared action.',
  component: () => null,
});
