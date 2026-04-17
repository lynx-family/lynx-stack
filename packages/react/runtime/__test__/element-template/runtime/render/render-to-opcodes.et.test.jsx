// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import {
  __OpAttr,
  __OpBegin,
  __OpEnd,
  __OpSlot,
  __OpText,
  renderToString,
} from '../../../../src/element-template/runtime/render/render-to-opcodes';

describe('Element Template renderToOpcodes', () => {
  it('should export correct opcodes', () => {
    expect(__OpBegin).toBe(0);
    expect(__OpEnd).toBe(1);
    expect(__OpAttr).toBe(2);
    expect(__OpText).toBe(3);
    expect(__OpSlot).toBe(4);
  });

  it('should emit slot opcodes for ET host slot arrays', () => {
    const Template = '_et_test_root';
    const opcodes = renderToString(
      <Template children={[null, null, null, <text>marker</text>]} />,
    );

    expect(opcodes[0]).toBe(__OpBegin);
    expect(opcodes).toContain(__OpSlot);
    expect(opcodes[opcodes.indexOf(__OpSlot) + 1]).toBe(3);
    expect(opcodes).toContain(__OpEnd);
  });

  it('should skip empty slot entries when rendering ET host slot arrays', () => {
    const Template = '_et_test_root';
    const opcodes = renderToString(
      <Template children={[false, 'first', null, true, 'second']} />,
    );

    const normalized = opcodes.map(item => (typeof item === 'object' ? '<vnode>' : item));
    expect(normalized).toEqual([
      __OpBegin,
      '<vnode>',
      __OpSlot,
      1,
      __OpText,
      'first',
      __OpSlot,
      4,
      __OpText,
      'second',
      __OpEnd,
    ]);
  });
});
