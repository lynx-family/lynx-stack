// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { SHARED_MARKER, spring } from './physics.js' with {
  runtime: 'shared',
};

export function onTap(event) {
  'main thread';
  event.target.setAttribute('text', SHARED_MARKER);
  event.target.setAttribute('value', spring(event.detail));
}
