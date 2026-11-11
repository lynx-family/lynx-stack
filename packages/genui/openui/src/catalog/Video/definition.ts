// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { stringLikeSchema } from '../utils.js';

/** Server-safe OpenUI definition for Video, with a null renderer. */
export const Video = defineComponent({
  name: 'Video',
  props: z.object({
    url: stringLikeSchema,
    title: stringLikeSchema.optional(),
  }),
  description: 'Video attachment placeholder with URL and optional title.',
  component: () => null,
});
