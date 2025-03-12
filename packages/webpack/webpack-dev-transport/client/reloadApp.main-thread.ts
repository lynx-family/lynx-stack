// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import _reloadApp from './reloadApp.js';

import type { Options, Status } from './index.js';

declare global {
  function reloadApp(opts: Options & { status: Status }): void;
}
globalThis.reloadApp = function(
  { status, ...options }: Options & { status: Status },
): void {
  _reloadApp(options, status);
};
