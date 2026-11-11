// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { reactive } from '../../core/runtime/reactive.js';

/** Server-safe Chat Callout component contract. */
export const Callout = defineComponent({
  name: 'Callout',
  props: z.object({
    variant: z.enum(['info', 'warning', 'error', 'success', 'neutral']),
    title: z.string(),
    description: z.string(),
    visible: reactive(z.boolean().optional()),
  }),
  description:
    'Callout banner with Markdown description. A reactive visible binding auto-dismisses after three seconds.',
  component: () => null,
});
