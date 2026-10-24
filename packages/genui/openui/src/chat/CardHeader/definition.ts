// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

/** Server-safe Chat CardHeader component contract. */
export const CardHeader = defineComponent({
  name: 'CardHeader',
  props: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
  }),
  description: 'Card heading with optional title and subtitle.',
  component: () => null,
});
