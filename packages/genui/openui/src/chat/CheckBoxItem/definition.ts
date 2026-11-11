// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

/** Server-safe CheckBoxItem component contract. */
export const CheckBoxItem = defineComponent({
  name: 'CheckBoxItem',
  props: z.object({
    label: z.string(),
    description: z.string(),
    name: z.string(),
    defaultChecked: z.boolean().optional(),
  }),
  description: 'Named checkbox option with optional initial selection.',
  component: () => null,
});
