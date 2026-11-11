// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { StepsItem } from '../StepsItem/definition.js';

/** Server-safe Steps component contract. */
export const Steps = defineComponent({
  name: 'Steps',
  props: z.object({ items: z.array(StepsItem.ref) }),
  description: 'Ordered steps with titles and details.',
  component: () => null,
});
