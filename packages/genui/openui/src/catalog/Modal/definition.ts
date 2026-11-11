// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { stringLikeSchema } from '../utils.js';

const modalPropsSchema = z.object({
  trigger: z.any(),
  content: z.any(),
  title: stringLikeSchema.optional(),
  closeOnAction: z.boolean().optional(),
});

/** Server-safe OpenUI definition for Modal, with a null renderer. */
export const Modal = defineComponent({
  name: 'Modal',
  props: modalPropsSchema,
  description:
    'Tap-triggered modal container. Pass the trigger component first and content second.',
  component: () => null,
});
