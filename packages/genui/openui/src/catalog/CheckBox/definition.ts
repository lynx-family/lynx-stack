// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { actionPropSchema } from '../Action/schema.js';

/** Server-safe OpenUI definition for CheckBox, with a null renderer. */
export const CheckBox = defineComponent({
  name: 'CheckBox',
  props: z.object({
    label: z.string(),
    value: z.boolean().optional(),
    action: actionPropSchema.optional(),
    name: z.string().optional(),
  }),
  description:
    'Toggleable checkbox. Use name when it participates in a form or stateful flow.',
  component: () => null,
});
