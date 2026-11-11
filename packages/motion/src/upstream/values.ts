// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The initial style is resolved in both React runtimes. Keep interpolation
// separate from the frame loop and the full main-thread animation engine.
export { transform } from 'motion-dom';
