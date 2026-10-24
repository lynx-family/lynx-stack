// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { reactive } from '../../core/runtime/reactive.js';
import { rulesSchema } from '../rules.js';

/** Server-safe Chat TextArea component contract. */
export const TextArea = defineComponent({
  name: 'TextArea',
  props: z.object({
    name: z.string(),
    placeholder: z.string().optional(),
    rows: z.number().optional(),
    rules: rulesSchema,
    value: reactive(z.string().optional()),
  }),
  description:
    'Multiline input with three visible rows by default, validation rules and a reactive value binding.',
  component: () => null,
});
