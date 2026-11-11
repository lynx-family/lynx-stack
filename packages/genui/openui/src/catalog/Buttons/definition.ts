// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { Button as ButtonDefinition } from '../Button/definition.js';

/** Server-safe OpenUI definition for Buttons, with a null renderer. */
export const Buttons = defineComponent({
  name: 'Buttons',
  props: z.object({
    buttons: z.array(ButtonDefinition.ref),
  }),
  description: 'Button group.',
  component: () => null,
});
