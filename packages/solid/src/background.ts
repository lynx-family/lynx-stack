// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { renderSolidLynx } from './renderer.js';
import { createRoot } from './root.js';
import type { Root } from './root.js';

export * from 'solid-js';

export * from './public.js';
export type { JSX } from './jsx.js';
export { effect } from './renderer.js';
export type { Root } from './root.js';

export const root: Root = createRoot('background', renderSolidLynx);
