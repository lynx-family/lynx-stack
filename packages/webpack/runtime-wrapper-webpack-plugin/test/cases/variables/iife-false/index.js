// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { fetch as myFetch } from './fetch.js';

expect(myFetch).not.toBe(lynx.fetch);

expect(myFetch()).toBe(42);

const fetch = () => {
  return 42;
};

expect(fetch()).toBe(42);
