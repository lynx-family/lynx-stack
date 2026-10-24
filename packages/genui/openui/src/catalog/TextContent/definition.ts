// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

/** Server-safe OpenUI definition for TextContent, with a null renderer. */
export const TextContent = defineComponent({
  name: 'TextContent',
  props: z.object({
    text: z.union([z.string(), z.number(), z.boolean()]),
    size: z.enum(['small', 'default', 'large', 'small-heavy', 'large-heavy'])
      .optional(),
  }),
  description: 'Text content with optional size.',
  component: () => null,
});
