import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hydrationMap } from '../../../../src/element-template/hydration-map.js';
import {
  clearRefState,
  flushDelayedRefUiOps,
  flushPendingRefs,
  getRefValue,
  prepareRefAttrSlot,
  queueRefAttrUpdate,
} from '../../../../src/element-template/prop-adapters/ref.js';

describe('ElementTemplate ref prop adapter', () => {
  beforeEach(() => {
    clearRefState();
  });

  it('prepares direct ref values as stable native markers', () => {
    expect(getRefValue(-2, 0)).toBe('-2-0');
    expect(prepareRefAttrSlot(-2, 0, () => {})).toBe('-2-0');
    expect(prepareRefAttrSlot(7, 3, { current: null })).toBe('7-3');
    expect(prepareRefAttrSlot(-2, 0, 1)).toBe('-2-0');
    expect(prepareRefAttrSlot(7, 3, null)).toBeNull();
    expect(prepareRefAttrSlot(7, 3, undefined)).toBeNull();
  });

  it('rejects non-marker invalid ref values like the Snapshot runtime', () => {
    const error = 'Elements\' "ref" property should be a function, or an object created by createRef()';

    expect(() => prepareRefAttrSlot(-2, 0, false)).toThrowError(error);
    expect(() => prepareRefAttrSlot(-2, 0, 'ref')).toThrowError(error);
    expect(() => prepareRefAttrSlot(-2, 0, {})).toThrowError(error);
  });

  it('attaches function refs with an ET selector proxy', () => {
    const ref = vi.fn();

    queueRefAttrUpdate(null, ref, -2, 0);
    flushPendingRefs();

    expect(ref).toHaveBeenCalledTimes(1);
    expect(ref.mock.calls[0]![0]).toMatchObject({
      selector: '[ref=-2-0]',
    });
  });

  it('detaches function refs through cleanup when the callback returned one', () => {
    const cleanup = vi.fn();
    const ref = vi.fn(() => cleanup);

    queueRefAttrUpdate(null, ref, -2, 0);
    flushPendingRefs();
    ref.mockClear();

    queueRefAttrUpdate(ref, null, -2, 0);
    flushPendingRefs();

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(ref).not.toHaveBeenCalled();
  });

  it('detaches function refs with null when there is no cleanup', () => {
    const ref = vi.fn();

    queueRefAttrUpdate(null, ref, -2, 0);
    flushPendingRefs();
    ref.mockClear();

    queueRefAttrUpdate(ref, null, -2, 0);
    flushPendingRefs();

    expect(ref).toHaveBeenCalledWith(null);
  });

  it('updates object refs and skips unchanged identities', () => {
    const ref = { current: null };

    queueRefAttrUpdate(null, ref, -2, 0);
    flushPendingRefs();

    expect(ref.current).toMatchObject({
      selector: '[ref=-2-0]',
    });
    const proxy = ref.current;

    queueRefAttrUpdate(ref, ref, -2, 0);
    flushPendingRefs();
    expect(ref.current).toBe(proxy);

    queueRefAttrUpdate(ref, null, -2, 0);
    flushPendingRefs();
    expect(ref.current).toBeNull();
  });

  it('delays NodesRef methods until hydration binds the stable handle', () => {
    const exec = vi.fn();
    const setNativeProps = vi.fn(() => ({ exec }));
    const select = vi.fn(() => ({ setNativeProps }));
    const createSelectorQuery = vi.fn(() => ({ select }));
    vi.stubGlobal('lynx', { createSelectorQuery });

    try {
      const ref = vi.fn();
      queueRefAttrUpdate(null, ref, -2, 0);
      flushPendingRefs();

      ref.mock.calls[0]![0].setNativeProps({ opacity: 1 }).exec();
      expect(select).not.toHaveBeenCalled();

      flushDelayedRefUiOps();

      expect(select).toHaveBeenCalledWith('[ref=-2-0]');
      expect(setNativeProps).toHaveBeenCalledWith({ opacity: 1 });
      expect(exec).toHaveBeenCalledTimes(1);

      select.mockClear();
      setNativeProps.mockClear();
      exec.mockClear();

      ref.mock.calls[0]![0].setNativeProps({ opacity: 2 }).exec();
      expect(select).toHaveBeenCalledWith('[ref=-2-0]');
      expect(setNativeProps).toHaveBeenCalledWith({ opacity: 2 });
      expect(exec).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('resolves delayed selectors through hydrated handle ids', () => {
    const exec = vi.fn();
    const setNativeProps = vi.fn(() => ({ exec }));
    const select = vi.fn(() => ({ setNativeProps }));
    const createSelectorQuery = vi.fn(() => ({ select }));
    vi.stubGlobal('lynx', { createSelectorQuery });

    try {
      const ref = vi.fn();
      queueRefAttrUpdate(null, ref, 1, 0);
      flushPendingRefs();

      ref.mock.calls[0]![0].setNativeProps({ opacity: 1 }).exec();
      hydrationMap.set(1, -2);
      flushDelayedRefUiOps();

      expect(select).toHaveBeenCalledWith('[ref=-2-0]');
      expect(setNativeProps).toHaveBeenCalledWith({ opacity: 1 });
      expect(exec).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
