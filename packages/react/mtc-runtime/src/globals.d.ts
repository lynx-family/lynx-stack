// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

declare const __DEV__: boolean;

declare function __AppendElement(
  parent: unknown,
  child: unknown,
): unknown;

declare const lynx: {
  reportError?: (error: Error) => void;
};

interface MtcGlobals {
  __mtc_runtime_init__?: boolean;
  registerMTC?: (hash: string, factory: (props: Record<string, unknown>) => unknown) => void;
  __initMtcRuntime?: (
    registerPatchHandler: (op: number, handler: (patch: unknown[], i: number) => number) => () => void,
    snapshotInstanceValues: Map<number, { __element_root?: unknown }>,
    destroyTasks: (() => void)[],
  ) => void;
}
