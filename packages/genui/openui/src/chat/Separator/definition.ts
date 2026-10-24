// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

/** Server-safe Chat Separator component contract. */
export const Separator = defineComponent({
  name: 'Separator',
  props: z.object({
    orientation: z.enum(['horizontal', 'vertical']).optional(),
    decorative: z.boolean().optional(),
  }),
  description: 'Visual divider, horizontal and decorative by default.',
  component: () => null,
});
