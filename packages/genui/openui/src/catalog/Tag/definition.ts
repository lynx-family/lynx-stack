// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

/** Server-safe OpenUI definition for Tag, with a null renderer. */
export const Tag = defineComponent({
  name: 'Tag',
  props: z.object({
    text: z.string(),
  }),
  description: 'Compact label or status tag.',
  component: () => null,
});
