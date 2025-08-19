// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { FunctionalComponent } from 'preact';

export const mtcComponentTypes: Map<string, FunctionalComponent> = new Map();

export function registerMTC(id: string, MTC: FunctionalComponent): void {
  mtcComponentTypes.set(id, MTC);
}
