// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options } from 'preact';
import { vi } from 'vitest';

import { DIFF, DIFF2, DIFFED, RENDER } from '../../src/renderToOpcodes/constants';

export const noop = vi.fn();

options[DIFF] = noop;
options[DIFF2] = noop;
options[RENDER] = noop;
options[DIFFED] = noop;
