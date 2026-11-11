// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { actionPropSchema } from '../Action/schema.js';

export const TEXT_FIELD_VARIANTS = [
  'longText',
  'number',
  'shortText',
  'obscured',
] as const;

const textFieldPropsSchema = z.object({
  label: z.string(),
  value: z.string().optional(),
  variant: z.enum(TEXT_FIELD_VARIANTS).optional(),
  validationRegexp: z.string().optional(),
  action: actionPropSchema.optional(),
  name: z.string().optional(),
});

/** Server-safe OpenUI definition for TextField, with a null renderer. */
export const TextField = defineComponent({
  name: 'TextField',
  props: textFieldPropsSchema,
  description:
    'Single-line or multi-line text input with optional regex validation.',
  component: () => null,
});
