// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { OPENUI_GAP_VALUES } from '../../shared/layout.js';
import { templateChildrenSchema } from '../utils.js';

const listChildrenSchema = z.union([z.array(z.any()), templateChildrenSchema]);

const listPropsSchema = z.object({
  children: listChildrenSchema.optional(),
  items: listChildrenSchema.optional(),
  direction: z.enum(['vertical', 'horizontal']).optional(),
  align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
  gap: z.enum(OPENUI_GAP_VALUES).optional(),
  divider: z.boolean().optional(),
});

/** Server-safe OpenUI definition for List, with a null renderer. */
export const List = defineComponent({
  name: 'List',
  props: listPropsSchema,
  description:
    'List container for repeated children. Pass child components first. The second argument is the optional items alias; pass null there before direction, align, gap, or divider: List(children, null, "vertical", "stretch", "s", false).',
  component: () => null,
});
