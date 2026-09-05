// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The group-level runtime: built without a main thread and without a template,
// loaded once per LynxGroup before any card and kept alive after the cards are
// gone. It owns the timers and the Promise the shared modules capture, which is
// what lets work started by one page outlive it.

console.info('[app] group runtime started');
