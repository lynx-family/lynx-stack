// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

/** Server-safe ProductFeature component contract. */
export const ProductFeature = defineComponent({
  name: 'ProductFeature',
  props: z.object({
    src: z.string(),
    alt: z.string(),
    title: z.string(),
    subtitle: z.string(),
    paragraphs: z.array(z.string()),
    price: z.string(),
    url: z.string(),
  }),
  description:
    'Document extension: product image, title, subtitle, paragraphs, price and link. Not an upstream Chat component.',
  component: () => null,
});
