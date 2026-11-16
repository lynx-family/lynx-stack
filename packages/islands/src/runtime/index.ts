// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** @packageDocumentation Load exposed island modules and create independent UI instances in Lynx hosts. */

export { prepareIslandBackground } from './prepare-background.js';
export { installIslandBackground } from './background-bridge.js';
export { createIsland } from './create.js';
export type { CreateIslandOptions, IslandInstance } from './create.js';
export { loadIslandModule } from './load.js';
export type {
  IslandModule,
  IslandRenderer,
  IslandReference,
  DispatchIslandBackground,
  LoadedIslandModule,
} from './types.js';
