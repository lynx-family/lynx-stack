// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { reactive } from '../../core/runtime/reactive.js';
import { rulesSchema } from '../rules.js';

/** Server-safe Slider component contract. */
export const Slider = defineComponent({
  name: 'Slider',
  props: z.object({
    name: z.string(),
    variant: z.enum(['continuous', 'discrete']),
    min: z.number(),
    max: z.number(),
    step: z.number().optional(),
    defaultValue: z.array(z.number()).optional(),
    label: z.string().optional(),
    rules: rulesSchema,
    value: reactive(z.array(z.number()).optional()),
  }),
  description:
    'Numeric slider whose value is an array. Multiple values provide independently adjustable range bounds.',
  component: () => null,
});
