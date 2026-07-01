// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Route, RouteId } from '../types.ts';
import { ROUTE_A } from './route-a-papi.ts';
import { ROUTE_B } from './route-b-shim.ts';
import { ROUTE_C } from './route-c-a2ui.ts';

/**
 * Single source of truth for which Route implementation handles each ID.
 *   - A: route-a-papi (raw Element PAPI direct output)   — US-105 ✅
 *   - B: route-b-shim (DOM Shim mock runner)             — US-106 ✅
 *   - C: route-c-a2ui (A2UI JSON DSL)                    — US-107 ✅
 */
export const ROUTES: Record<RouteId, Route> = {
  A: ROUTE_A,
  B: ROUTE_B,
  C: ROUTE_C,
};
