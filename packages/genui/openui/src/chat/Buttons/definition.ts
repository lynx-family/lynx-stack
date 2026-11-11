// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { Button } from '../../catalog/Button/definition.js';

/** Server-safe Chat button group definition. */
export const Buttons = defineComponent({
  name: 'Buttons',
  props: z.object({
    buttons: z.array(Button.ref),
    direction: z.enum(['row', 'column']).optional(),
  }),
  description: 'Buttons arranged in a row (default) or column.',
  component: () => null,
});
