import { afterEach, describe, expect, it, vi } from 'vitest';

import { processGesture } from '../../src/gesture/processGesture';

describe('processGesture', () => {
  const originalSetAttribute = globalThis.__SetAttribute;

  afterEach(() => {
    globalThis.__SetAttribute = originalSetAttribute;
  });

  it('clears native gesture state when gesture is removed', () => {
    const setAttribute = vi.fn();
    globalThis.__SetAttribute = setAttribute;

    const dom = {};
    const oldGesture = {
      type: 0,
      __isSerialized: true,
    };

    processGesture(dom, undefined, oldGesture, false);

    expect(setAttribute).toHaveBeenCalledWith(dom, 'has-react-gesture', null);
    expect(setAttribute).toHaveBeenCalledWith(dom, 'flatten', null);
    expect(setAttribute).toHaveBeenCalledWith(dom, 'gesture', null);
  });

  it('does not clear native state when domSet=true', () => {
    const setAttribute = vi.fn();
    globalThis.__SetAttribute = setAttribute;

    const dom = {};
    const oldGesture = {
      type: 0,
      __isSerialized: true,
    };

    processGesture(dom, undefined, oldGesture, false, { domSet: true });
    expect(setAttribute).not.toHaveBeenCalled();
  });

  it('does not clear native state when oldGesture is not serialized', () => {
    const setAttribute = vi.fn();
    globalThis.__SetAttribute = setAttribute;

    const dom = {};
    const oldGesture = {
      type: 0,
      __isSerialized: false,
    };

    processGesture(dom, undefined, oldGesture, false);
    expect(setAttribute).not.toHaveBeenCalled();
  });
});
