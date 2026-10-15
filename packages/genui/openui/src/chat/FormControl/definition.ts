// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { CheckBoxGroup } from '../CheckBoxGroup/definition.js';
import { Input } from '../Input/definition.js';
import { RadioGroup } from '../RadioGroup/definition.js';
import { Slider } from '../Slider/definition.js';

/** Server-safe FormControl component contract. */
export const FormControl = defineComponent({
  name: 'FormControl',
  props: z.object({
    label: z.string(),
    input: z.union([Input.ref, Slider.ref, CheckBoxGroup.ref, RadioGroup.ref]),
    hint: z.string().optional(),
  }),
  description:
    'Label, control and optional hint; validation errors are shown automatically.',
  component: () => null,
});
