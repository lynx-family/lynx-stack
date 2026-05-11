// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createLibrary } from './library.js';
import type { Library } from './library.js';
import * as c from '../catalog/index.js';

export function createOpenUiLibrary(): Library {
  return createLibrary({
    root: 'Stack',
    components: [
      c.Stack,
      c.Card,
      c.CardHeader,
      c.TextContent,
      c.Separator,
      c.Button,
      c.Buttons,
      c.Tag,
    ],
    componentGroups: [
      { name: 'Layout', components: ['Stack'] },
      {
        name: 'Content',
        components: ['Card', 'CardHeader', 'TextContent', 'Separator'],
      },
      { name: 'Buttons', components: ['Button', 'Buttons'] },
      { name: 'Data Display', components: ['Tag'] },
    ],
  });
}
