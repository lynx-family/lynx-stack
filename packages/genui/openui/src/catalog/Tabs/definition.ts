// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { stringLikeSchema } from '../utils.js';

const tabSchema = z.object({
  value: z.string(),
  title: stringLikeSchema,
  child: z.any(),
});

const tabsPropsSchema = z.object({
  tabs: z.array(tabSchema),
  value: z.string().optional(),
});

/** Server-safe OpenUI definition for Tabs, with a null renderer. */
export const Tabs = defineComponent({
  name: 'Tabs',
  props: tabsPropsSchema,
  description:
    'Tabbed content switcher. Each tab item is an object with value, title, and child.',
  component: () => null,
});
