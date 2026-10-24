// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { reactive } from '../../core/runtime/reactive.js';
import { rulesSchema } from '../rules.js';

/** Server-safe Input component contract. */
export const Input = defineComponent({
  name: 'Input',
  props: z.object({
    name: z.string(),
    placeholder: z.string().optional(),
    type: z.enum(['text', 'email', 'password', 'number', 'url']).optional(),
    rules: rulesSchema,
    value: reactive(z.string().optional()),
  }),
  description:
    'Single-line input with optional validation rules and a reactive value binding.',
  component: () => null,
});
