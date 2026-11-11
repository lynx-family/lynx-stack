// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { actionPropSchema } from '../Action/schema.js';

const buttonPropsSchema = z.object({
  label: z.string(),
  action: actionPropSchema.optional(),
  variant: z.enum(['primary', 'secondary', 'tertiary']).optional(),
  type: z.enum(['normal', 'destructive']).optional(),
  size: z.enum(['extra-small', 'small', 'medium', 'large']).optional(),
});

/** Server-safe OpenUI definition for Button, with a null renderer. */
export const Button = defineComponent({
  name: 'Button',
  props: buttonPropsSchema,
  description: 'Clickable button.',
  component: () => null,
});
