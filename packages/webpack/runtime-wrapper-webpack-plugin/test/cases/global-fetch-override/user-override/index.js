/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
/// <reference types="vitest/globals" />

function fetch() {
  return 'fetch from user';
}
var jsb = {
  fetch: fetch,
};
it('user override should works', () => {
  expect(jsb.fetch()).toBe('fetch from user');
});
