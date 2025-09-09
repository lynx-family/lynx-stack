// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/// <reference types="@lynx-js/rspeedy/client" />

declare const Codspeed: {
  startBenchmark(): void;
  stopBenchmark(): void;
  setExecutedBenchmark(name: string): void;
  zeroStats(): void;
};

/**
 * This function will be called after the script is loaded and executed.
 * Codspeed don't allow stacked benchmark, but sadly we have some cases
 * benchmark is executed while loading script, we need to move those cases
 * to after script load using this API.
 * @param cb The callback to run after script loaded.
 */
declare function runAfterLoadScript(cb: () => void): void;

declare const __REPO_FILEPATH__: string;
