// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from '@rstest/core';

import * as lynxJsxDevRuntime from '@lynx-js/react/jsx-dev-runtime';
import * as lynxJsxRuntime from '@lynx-js/react/jsx-runtime';

import * as jsxDevRuntime from '../jsx-dev-runtime.js';
import * as jsxRuntime from '../jsx-runtime.js';

describe('@lynx-js/react-compat/jsx-runtime', () => {
  it('re-exports the `@lynx-js/react` JSX runtime', () => {
    expect(jsxRuntime.jsx).toBe(lynxJsxRuntime.jsx);
    expect(jsxRuntime.jsxs).toBe(lynxJsxRuntime.jsxs);
    expect(jsxRuntime.Fragment).toBe(lynxJsxRuntime.Fragment);
  });

  it('re-exports the `@lynx-js/react` JSX dev runtime', () => {
    expect(jsxDevRuntime.jsx).toBe(lynxJsxDevRuntime.jsx);
    expect(jsxDevRuntime.jsxs).toBe(lynxJsxDevRuntime.jsxs);
    expect(jsxDevRuntime.jsxDEV).toBe(lynxJsxDevRuntime.jsxDEV);
    expect(jsxDevRuntime.Fragment).toBe(lynxJsxDevRuntime.Fragment);
  });
});
