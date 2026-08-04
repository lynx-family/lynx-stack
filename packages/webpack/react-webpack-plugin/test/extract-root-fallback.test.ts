// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from '@rstest/core';

import { extractRootFallback } from '../src/loaders/extractRootFallback.js';

describe('extractRootFallback', () => {
  it('extracts the static fallback snapshot of a root <Background>', () => {
    const result = extractRootFallback(`
root.render(/*#__PURE__*/ _jsx(Background, {
    fallback: /*#__PURE__*/ _jsx(__snapshot_e540c_index_1, {}),
    children: /*#__PURE__*/ _jsx(App, {})
}));
`);
    expect(result?.id).toBe('__snapshot_e540c_index_1');
    expect(result?.warning).toBeUndefined();
  });

  it('finds the fallback prop after a children prop', () => {
    const result = extractRootFallback(`
root.render(_jsxs(Background, {
    children: [_jsx(App, {}), _jsx(Other, { header: { fallback: 1 } })],
    fallback: _jsx(__snapshot_a_b_1, {})
}));
`);
    expect(result?.id).toBe('__snapshot_a_b_1');
  });

  it('returns nothing for a module without a root <Background>', () => {
    expect(extractRootFallback(`
root.render(/*#__PURE__*/ _jsx(App, {}));
`)).toBeUndefined();
  });

  it('treats a missing fallback prop as the fallback={null} degenerate case', () => {
    const result = extractRootFallback(`
root.render(_jsx(Background, {
    children: _jsx(App, {})
}));
`);
    expect(result).toEqual({});
  });

  it('warns on a fallback that is not a snapshot (a user component)', () => {
    const result = extractRootFallback(`
root.render(_jsx(Background, {
    fallback: /*#__PURE__*/ _jsx(Spinner, {}),
    children: _jsx(App, {})
}));
`);
    expect(result?.id).toBeUndefined();
    expect(result?.warning).toMatch(/static host elements/);
  });

  it('warns on a snapshot fallback with dynamic parts', () => {
    const result = extractRootFallback(`
root.render(_jsx(Background, {
    fallback: _jsx(__snapshot_a_b_1, {
        values: [label]
    }),
    children: _jsx(App, {})
}));
`);
    expect(result?.id).toBeUndefined();
    expect(result?.warning).toMatch(/static host elements/);
  });

  it('does not read a nested fallback key as the root one', () => {
    const result = extractRootFallback(`
root.render(_jsx(Background, {
    children: _jsx(App, {
        fallback: _jsx(__snapshot_nested_1, {})
    })
}));
`);
    expect(result).toEqual({});
  });

  it('is not fooled by braces inside string props', () => {
    const result = extractRootFallback(`
root.render(_jsx(Background, {
    label: "not } a { boundary",
    fallback: _jsx(__snapshot_a_b_2, {})
}));
`);
    expect(result?.id).toBe('__snapshot_a_b_2');
  });
});
