// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { stringLikeSchema } from '../utils.js';

export const textVariants = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'caption',
  'body',
] as const;

/** Server-safe OpenUI definition for Text, with a null renderer. */
export const Text = defineComponent({
  name: 'Text',
  props: z.object({
    text: stringLikeSchema,
    variant: z.enum(textVariants).optional(),
  }),
  description:
    'Plain text with semantic variants h1, h2, h3, h4, h5, caption, and body.',
  component: () => null,
});
