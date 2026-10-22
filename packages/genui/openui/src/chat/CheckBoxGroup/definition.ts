// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { reactive } from '../../core/runtime/reactive.js';
import { CheckBoxItem } from '../CheckBoxItem/definition.js';
import { rulesSchema } from '../rules.js';

/** Server-safe CheckBoxGroup component contract. */
export const CheckBoxGroup = defineComponent({
  name: 'CheckBoxGroup',
  props: z.object({
    name: z.string(),
    items: z.array(CheckBoxItem.ref),
    rules: rulesSchema,
    value: reactive(z.record(z.string(), z.boolean()).optional()),
  }),
  description:
    'Checkboxes stored as an object keyed by item name. Shared bindings preserve keys in other groups.',
  component: () => null,
});
