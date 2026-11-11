// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { reactive } from '../../core/runtime/reactive.js';
import { RadioItem } from '../RadioItem/definition.js';
import { rulesSchema } from '../rules.js';

/** Server-safe RadioGroup component contract. */
export const RadioGroup = defineComponent({
  name: 'RadioGroup',
  props: z.object({
    name: z.string(),
    items: z.array(RadioItem.ref),
    defaultValue: z.string().optional(),
    rules: rulesSchema,
    value: reactive(z.string().optional()),
  }),
  description:
    'Single selection with optional default value, validation and reactive binding.',
  component: () => null,
});
