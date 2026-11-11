// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { stringLikeSchema } from '../utils.js';

/** Server-safe OpenUI definition for Image, with a null renderer. */
export const Image = defineComponent({
  name: 'Image',
  props: z.object({
    url: stringLikeSchema,
    fit: z.enum(['contain', 'cover', 'fill', 'none', 'scale-down']).optional(),
    variant: z.enum([
      'icon',
      'avatar',
      'smallFeature',
      'mediumFeature',
      'largeFeature',
      'header',
    ]).optional(),
  }),
  description: 'Image with optional fit and variant sizing.',
  component: () => null,
});
