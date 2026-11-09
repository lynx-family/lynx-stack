// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Shared TypeScript types for `@lynx-js/lynx-runtime`.
 *
 * @remarks
 * Import shared types from `@lynx-js/lynx-runtime`, main-thread runtime functions
 * from `@lynx-js/lynx-runtime/mts`, and background-thread page binding from
 * `@lynx-js/lynx-runtime/bts`. In dual-thread shared modules, guard `/mts` and
 * `/bts` runtime calls behind compile-time thread constants (such as `__LEPUS__`
 * and `__JS__`) so bundler dead-code elimination strips cross-thread imports.
 *
 * @packageDocumentation
 */
export type {
  BTSEventHandler,
  BTSPageRuntime,
  BTSReloadOptions,
  BTSUpdateOptions,
  CreatedPipelineOptions,
  CreatePipelineOptions,
  LynxSystemInfo,
  MTSFlushContext,
  MTSFlushOptions,
  MTSReloadOptions,
  MTSRenderOptions,
  MTSUpdateOptions,
  PipelineOptions,
  Unsubscribe,
} from './common/types.js';
