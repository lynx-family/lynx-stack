// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { RadioGroup } from './RadioGroup/index.jsx';
import { componentRegistry } from '../core/ComponentRegistry.js';
import type { ComponentRenderer } from '../core/ComponentRegistry.js';

componentRegistry.register(
  'RadioGroup',
  RadioGroup as unknown as ComponentRenderer,
);

export { RadioGroup };
