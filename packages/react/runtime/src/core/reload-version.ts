// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

let reloadVersion = 0;

export function getReloadVersion(): number {
  return reloadVersion;
}

export function increaseReloadVersion(): number {
  return ++reloadVersion;
}
