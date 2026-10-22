// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';
import { z } from 'zod/v4';

import { Col } from '../Col/definition.js';

/** Server-safe Table component contract. */
export const Table = defineComponent({
  name: 'Table',
  props: z.object({ columns: z.array(Col.ref) }),
  description:
    'Table with columns declared using Col; row count follows column data.',
  component: () => null,
});
