// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// @ts-expect-error
globalThis.nativeConsole = console;

export { startBackgroundThread } from './background-apis/startBackgroundThread.js';
