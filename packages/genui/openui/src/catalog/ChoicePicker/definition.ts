// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { booleanLikeSchema, stringLikeSchema } from '../utils.js';

const choicePickerPropsSchema = z.object({
  label: stringLikeSchema.optional(),
  options: z.union([z.array(stringLikeSchema), stringLikeSchema]),
  value: stringLikeSchema.optional(),
  variant: z.enum(['default', 'card']).optional(),
  displayStyle: z.enum(['list', 'chips', 'dropdown']).optional(),
  filterable: booleanLikeSchema.optional(),
});

/** Server-safe OpenUI definition for ChoicePicker, with a null renderer. */
export const ChoicePicker = defineComponent({
  name: 'ChoicePicker',
  props: choicePickerPropsSchema,
  description:
    'Choice picker rendered as selectable chips, list items, or a dropdown-like field.',
  component: () => null,
});
