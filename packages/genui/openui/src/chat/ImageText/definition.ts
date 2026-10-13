// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

/** Server-safe ImageText component contract. */
export const ImageText = defineComponent({
  name: 'ImageText',
  props: z.object({
    src: z.string(),
    alt: z.string().optional(),
    title: z.string(),
    subtitle: z.string().optional(),
    bold: z.boolean().default(false),
    layout: z.enum(['horizontal', 'vertical']).default('horizontal'),
    imageSize: z.number().optional(),
  }),
  description: 'Image and text, arranged horizontally or vertically.',
  component: () => null,
});
