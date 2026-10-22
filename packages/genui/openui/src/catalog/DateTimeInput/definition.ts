// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { booleanLikeSchema, stringLikeSchema } from '../utils.js';

const dateTimeInputPropsSchema = z.object({
  value: stringLikeSchema,
  enableDate: booleanLikeSchema.optional(),
  enableTime: booleanLikeSchema.optional(),
  min: stringLikeSchema.optional(),
  max: stringLikeSchema.optional(),
  label: stringLikeSchema.optional(),
});

/** Server-safe OpenUI definition for DateTimeInput, with a null renderer. */
export const DateTimeInput = defineComponent({
  name: 'DateTimeInput',
  props: dateTimeInputPropsSchema,
  description:
    'Date/time value display with optional label, min/max, and enabled date/time hints.',
  component: () => null,
});
