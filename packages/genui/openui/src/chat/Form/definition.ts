// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { Buttons } from '../Buttons/definition.js';
import { FormControl } from '../FormControl/definition.js';

/** Server-safe Form component contract. */
export const Form = defineComponent({
  name: 'Form',
  props: z.object({
    name: z.string(),
    buttons: Buttons.ref,
    fields: z.array(FormControl.ref).default([]),
  }),
  description:
    'Named form with explicit buttons and independently declared controls. Do not nest forms.',
  component: () => null,
});
