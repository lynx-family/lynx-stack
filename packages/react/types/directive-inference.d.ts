// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MainThreadDeep, MainThreadFn } from './react.js';

type MainThreadCall<Args extends readonly unknown[]> = {
  readonly __args?: Args;
};
type MainThreadMarker = {
  readonly __mainThreadMarker?: true;
};

/**
 * Source declaration for the generated package directive-inference manifest.
 *
 * @internal
 */
export interface DirectiveInferenceManifest {
  mainThread: MainThreadMarker;
  useMainThreadEffect: MainThreadCall<[
    fn: MainThreadFn | null | undefined,
  ]>;
  useMainThreadEvent: MainThreadCall<[
    fn: MainThreadFn | null | undefined,
  ]>;
  useMainThreadEvents: MainThreadCall<[
    value: MainThreadDeep<unknown>,
  ]>;
  useMainThreadInstance: MainThreadCall<[
    create: MainThreadFn | null | undefined,
    dispose?: MainThreadFn | null,
  ]>;
}
