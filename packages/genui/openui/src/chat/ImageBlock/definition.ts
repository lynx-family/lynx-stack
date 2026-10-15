// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

/** Server-safe Chat ImageBlock component contract. */
export const ImageBlock = defineComponent({
  name: 'ImageBlock',
  props: z.object({
    src: z.string(),
    alt: z.string().optional(),
  }),
  description: 'Image content block with loading and error states.',
  component: () => null,
});
