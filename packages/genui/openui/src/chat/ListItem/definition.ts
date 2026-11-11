// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { actionPropSchema } from '../../catalog/Action/schema.js';

/** Server-safe ListItem component contract. */
export const ListItem = defineComponent({
  name: 'ListItem',
  props: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    image: z.object({ src: z.string(), alt: z.string() }).optional(),
    actionLabel: z.string().optional(),
    action: actionPropSchema.optional(),
  }),
  description: 'List entry with optional subtitle, image and action.',
  component: () => null,
});
