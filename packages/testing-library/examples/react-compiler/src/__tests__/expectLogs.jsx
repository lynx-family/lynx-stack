// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the MIT license that can be found in the
// LICENSE file in the root directory of this source tree.

const logs = [];

export function log(message) {
  logs.push(message);
}

export function expectLogsAndClear(expected) {
  expect(logs).toEqual(expected);
  logs.length = 0;
}
