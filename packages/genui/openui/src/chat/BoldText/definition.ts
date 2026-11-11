// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineComponent } from '@openuidev/lang-core';

import { Text } from '../Text/definition.js';

/** Server-safe Chat text definition with emphasized primary text. */
export const BoldText = defineComponent({
  name: 'BoldText',
  props: Text.props.extend({}),
  description: 'Emphasized text with the same arguments as Text.',
  component: () => null,
});
