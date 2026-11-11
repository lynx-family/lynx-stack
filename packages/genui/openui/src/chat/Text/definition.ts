// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

/** Server-safe Chat text definition, with the official positional arguments. */
export const Text = defineComponent({
  name: 'Text',
  props: z.object({
    variant: z.enum(['text', 'number']).default('text'),
    value: z.string(),
    subtext: z.string().optional(),
    subtextVariant: z.enum(['text', 'number', 'metric']).default('text'),
    size: z.enum(['xs', 'sm', 'md', 'lg']).default('sm'),
  }),
  description:
    'Text with optional subtext. Metric subtext colors a leading +/- value.',
  component: () => null,
});
