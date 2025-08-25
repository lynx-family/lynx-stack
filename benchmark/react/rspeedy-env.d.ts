// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/// <reference types="@lynx-js/rspeedy/client" />

declare const Codspeed: {
  startBenchmark(): void;
  stopBenchmark(): void;
  setExecutedBenchmark(name: string): void;
};

declare const __REPO_FILEPATH__: string;
