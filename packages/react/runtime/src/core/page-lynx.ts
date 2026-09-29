// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

let boundLynx: typeof lynx | undefined;

export function bindPageLynx(pageLynx: typeof lynx): void {
  if (boundLynx) {
    throw new Error('createRoot(lynx) can be called only once per ReactLynx runtime.');
  }
  boundLynx = pageLynx;
}

export function hasPageLynx(): boolean {
  return boundLynx !== undefined;
}

export function getPageLynx(): typeof lynx {
  return boundLynx ?? lynx;
}
