// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { actionPropSchema } from '../Action/schema.js';

const sliderPropsSchema = z.object({
  label: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  value: z.number().optional(),
  step: z.number().optional(),
  action: actionPropSchema.optional(),
  name: z.string().optional(),
});

/** Server-safe OpenUI definition for Slider, with a null renderer. */
export const Slider = defineComponent({
  name: 'Slider',
  props: sliderPropsSchema,
  description: 'Continuous-value slider.',
  component: () => null,
});
