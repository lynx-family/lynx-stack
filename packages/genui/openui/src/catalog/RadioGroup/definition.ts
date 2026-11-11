// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { actionPropSchema } from '../Action/schema.js';

const radioGroupPropsSchema = z.object({
  items: z.array(z.string()),
  value: z.string().optional(),
  usageHint: z.enum(['default', 'card', 'row']).optional(),
  action: actionPropSchema.optional(),
  name: z.string().optional(),
});

/** Server-safe OpenUI definition for RadioGroup, with a null renderer. */
export const RadioGroup = defineComponent({
  name: 'RadioGroup',
  props: radioGroupPropsSchema,
  description: 'Single-choice radio group.',
  component: () => null,
});
