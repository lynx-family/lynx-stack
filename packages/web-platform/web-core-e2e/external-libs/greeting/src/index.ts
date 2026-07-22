// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './index.css';

declare let __webpack_public_path__: string;

export function getGreeting(): string {
  return 'hello-from-external';
}

export function getPublicPath(): string {
  return __webpack_public_path__;
}
