// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

/** Server-safe Chat InlineHeader component contract. */
export const InlineHeader = defineComponent({
  name: 'InlineHeader',
  props: z.object({
    heading: z.string(),
    description: z.string().optional(),
  }),
  description:
    'Compact section heading and optional description, with inline Markdown.',
  component: () => null,
});
