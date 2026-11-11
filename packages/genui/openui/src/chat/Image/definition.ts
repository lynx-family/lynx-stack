// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

/** Server-safe Chat Image component contract. */
export const Image = defineComponent({
  name: 'Image',
  props: z.object({
    alt: z.string(),
    src: z.string().optional(),
  }),
  description: 'Image with alt text first and an optional source URL.',
  component: () => null,
});
