// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from '@rstest/core';

import { islandModuleWrapper } from '../src/MainThreadIslands.js';

function decode(wrapper: string): string {
  expect(wrapper.startsWith('data:text/javascript,')).toBe(true);
  return decodeURIComponent(wrapper.slice('data:text/javascript,'.length));
}

describe('islandModuleWrapper', () => {
  it('imports the whole namespace so the exports survive tree shaking', () => {
    const source = decode(islandModuleWrapper('/abs/Shell.tsx'));

    expect(source).toContain('import * as ns from "/abs/Shell.tsx";');
    // Storing the namespace is what makes the import load-bearing: nothing
    // else in the main-thread layer references the module.
    expect(source).toContain('Symbol.for("__REACT_LYNX_MTS_ISLANDS__")');
    expect(source).toContain('.set("/abs/Shell.tsx", ns);');
  });

  it('stays free of syntax no loader will lower', () => {
    // A `data:` URI matches no module rule, so the wrapper reaches the main
    // thread exactly as written — no arrow functions, no `let`/`const`.
    const source = decode(islandModuleWrapper('/abs/Shell.tsx'));

    expect(source).not.toMatch(/=>/);
    expect(source).not.toMatch(/\b(let|const)\b/);
  });
});
