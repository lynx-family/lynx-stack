// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Hand-crafted worklet registrations for e2e demos (DEV-ONLY).
 *
 * The rspeedy plugin appends this file's built output to the main-thread
 * bundle only in development mode, so production bundles pay zero cost.
 *
 * Currently empty: all demos use the SWC worklet transform ('main thread'
 * directive) which auto-generates registerWorkletInternal calls.
 */

export {};
