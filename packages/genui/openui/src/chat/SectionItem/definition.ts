// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

/** Server-safe SectionItem component contract. */
export const SectionItem = defineComponent({
  name: 'SectionItem',
  props: z.object({
    value: z.string(),
    trigger: z.string(),
    content: z.array(z.any()),
  }),
  description:
    'Named section with a unique value and an array of registered Chat components.',
  component: () => null,
});
