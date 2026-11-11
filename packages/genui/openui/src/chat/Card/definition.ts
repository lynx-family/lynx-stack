// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

/** Server-safe definition of the OpenUI Chat root container. */
export const Card = defineComponent({
  name: 'Card',
  props: z.object({
    children: z.array(z.any()),
    sources: z.array(z.object({
      url: z.string().optional(),
      title: z.string(),
      sourceName: z.string(),
    })).optional(),
  }),
  description:
    'Vertical chat response. Sources back one-based [n] citations in TextContent.',
  component: () => null,
});
