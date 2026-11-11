// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

/** Server-safe RadioItem component contract. */
export const RadioItem = defineComponent({
  name: 'RadioItem',
  props: z.object({
    label: z.string(),
    description: z.string(),
    value: z.string(),
  }),
  description: 'Radio option with label, description and unique value.',
  component: () => null,
});
