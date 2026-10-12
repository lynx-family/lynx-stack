// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

/** Server-safe OpenUI definition for Divider, with a null renderer. */
export const Divider = defineComponent({
  name: 'Divider',
  props: z.object({
    axis: z.enum(['horizontal', 'vertical']).optional(),
  }),
  description: 'Horizontal or vertical divider.',
  component: () => null,
});
