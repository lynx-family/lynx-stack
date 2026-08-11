// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ComponentGroup, DefinedComponent } from './library.jsx';
import { Stack } from '../catalog/Stack/index.jsx';

export const DEFAULT_COMPONENTS: DefinedComponent<any>[] = [Stack];

export const DEFAULT_COMPONENT_GROUPS: ComponentGroup[] = [
  { name: 'Layout', components: ['Stack'] },
];
