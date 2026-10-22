// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { SectionItem } from '../SectionItem/definition.js';

/** Server-safe SectionBlock component contract. */
export const SectionBlock = defineComponent({
  name: 'SectionBlock',
  props: z.object({
    sections: z.array(SectionItem.ref),
    isFoldable: z.boolean().optional(),
  }),
  description:
    'Collapsible sections. New sections open during streaming. Set isFoldable false for flat headers.',
  component: () => null,
});
