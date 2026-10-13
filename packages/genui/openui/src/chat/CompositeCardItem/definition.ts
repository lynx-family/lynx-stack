// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { Button } from '../../catalog/Button/definition.js';
import { BoldText } from '../BoldText/definition.js';
import { ImageText } from '../ImageText/definition.js';
import { ListBlock } from '../ListBlock/definition.js';
import { Text } from '../Text/definition.js';

/** Server-safe CompositeCardItem component contract. */
export const CompositeCardItem = defineComponent({
  name: 'CompositeCardItem',
  props: z.object({
    id: z.string().optional(),
    header: z.union([ImageText.ref, Text.ref]).optional(),
    body: z.array(z.union([Text.ref, BoldText.ref, ListBlock.ref])).default([]),
    footer: z.object({
      price: z.optional(BoldText.ref),
      button: z.optional(Button.ref),
    }).optional(),
  }),
  description:
    'Rich card with optional id, header, body and price/button footer.',
  component: () => null,
});
