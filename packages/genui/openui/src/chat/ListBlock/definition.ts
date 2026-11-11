// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { ListItem } from '../ListItem/definition.js';

/** Server-safe ListBlock component contract. */
export const ListBlock = defineComponent({
  name: 'ListBlock',
  props: z.object({
    items: z.array(ListItem.ref),
    variant: z.enum(['number', 'image']).optional(),
    size: z.enum(['default', 'small']).optional(),
  }),
  description:
    'Numbered or illustrated list; only entries with an action are clickable.',
  component: () => null,
});
