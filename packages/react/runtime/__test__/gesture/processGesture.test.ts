import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { processGesture } from '../../src/gesture/processGesture.js';

function createSerializedGesture(id: number) {
  return {
    id,
    type: 0,
    callbacks: {
      onUpdate: {
        _wkltId: 'bdd4:dd564:2',
      },
    },
    __isSerialized: true,
  };
}

function createSerializedComposedGesture(gestures: ReturnType<typeof createSerializedGesture>[]) {
  return {
    type: -1,
    gestures,
    __isSerialized: true,
  };
}

describe('processGesture', () => {
  let setAttribute: ReturnType<typeof vi.fn>;
  let setGestureDetector: ReturnType<typeof vi.fn>;
  let removeGestureDetector: ReturnType<typeof vi.fn>;
  let hydrateCtx: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setAttribute = vi.fn();
    setGestureDetector = vi.fn();
    removeGestureDetector = vi.fn();
    hydrateCtx = vi.fn();

    vi.stubGlobal('__SetAttribute', setAttribute);
    vi.stubGlobal('__SetGestureDetector', setGestureDetector);
    vi.stubGlobal('__RemoveGestureDetector', removeGestureDetector);
    vi.stubGlobal('lynxWorkletImpl', {
      _hydrateCtx: hydrateCtx,
      _jsFunctionLifecycleManager: {
        addRef: vi.fn(),
      },
      _eventDelayImpl: {
        runDelayedWorklet: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets detector on mount with expected params', () => {
    const dom = {} as FiberElement;
    const gesture = createSerializedGesture(1);

    processGesture(dom, gesture as any, undefined, false);

    expect(setAttribute).toHaveBeenCalledWith(dom, 'has-react-gesture', true);
    expect(setAttribute).toHaveBeenCalledWith(dom, 'flatten', false);
    expect(setGestureDetector).toHaveBeenCalledTimes(1);
    expect(setGestureDetector).toHaveBeenCalledWith(
      dom,
      1,
      0,
      {
        callbacks: [
          {
            name: 'onUpdate',
            callback: expect.objectContaining({
              _wkltId: 'bdd4:dd564:2',
            }),
          },
        ],
      },
      {
        waitFor: [],
        simultaneous: [],
        continueWith: [],
      },
    );
    expect(removeGestureDetector).not.toHaveBeenCalled();
  });

  it('skips attribute writes when domSet option is true', () => {
    const dom = {} as FiberElement;
    const gesture = createSerializedGesture(1);

    processGesture(dom, gesture as any, undefined, false, { domSet: true });

    expect(setAttribute).not.toHaveBeenCalled();
    expect(setGestureDetector).toHaveBeenCalledTimes(1);
  });

  it('removes old detector first and then sets new detector on diff', () => {
    const dom = {} as FiberElement;
    const gestureA = createSerializedGesture(1);
    const gestureB = createSerializedGesture(2);

    processGesture(dom, gestureA as any, undefined, false);
    setAttribute.mockClear();
    setGestureDetector.mockClear();
    removeGestureDetector.mockClear();

    processGesture(dom, gestureB as any, gestureA as any, false);

    expect(removeGestureDetector).toHaveBeenCalledTimes(1);
    expect(removeGestureDetector).toHaveBeenCalledWith(dom, 1);
    expect(setGestureDetector).toHaveBeenCalledTimes(1);
    expect(setGestureDetector).toHaveBeenCalledWith(
      dom,
      2,
      0,
      {
        callbacks: [
          {
            name: 'onUpdate',
            callback: expect.objectContaining({
              _wkltId: 'bdd4:dd564:2',
            }),
          },
        ],
      },
      {
        waitFor: [],
        simultaneous: [],
        continueWith: [],
      },
    );
  });

  it('removes only old gesture detector when gesture is deleted', () => {
    const dom = {} as FiberElement;
    const gestureA = createSerializedGesture(1);
    const gestureB = createSerializedGesture(2);

    processGesture(dom, gestureA as any, undefined, false);
    processGesture(dom, gestureB as any, gestureA as any, false);
    setAttribute.mockClear();
    setGestureDetector.mockClear();
    removeGestureDetector.mockClear();

    processGesture(dom, undefined as any, gestureB as any, false);

    expect(setGestureDetector).not.toHaveBeenCalled();
    expect(removeGestureDetector).toHaveBeenCalledTimes(1);
    const removedIds = removeGestureDetector.mock.calls.map(([, id]) => id).sort((a, b) => a - b);
    expect(removedIds).toEqual([2]);
    expect(setAttribute).toHaveBeenCalledWith(dom, 'has-react-gesture', null);
  });

  it('deduplicates same-id gestures in composed gesture diff', () => {
    const dom = {} as FiberElement;
    const gestureA = createSerializedGesture(1);
    const gestureADuplicate = createSerializedGesture(1);
    const composedGesture = createSerializedComposedGesture([gestureA, gestureADuplicate]);

    processGesture(dom, composedGesture as any, undefined, false);

    expect(setGestureDetector).toHaveBeenCalledTimes(1);
    expect(setGestureDetector).toHaveBeenCalledWith(
      dom,
      1,
      0,
      {
        callbacks: [
          {
            name: 'onUpdate',
            callback: expect.objectContaining({
              _wkltId: 'bdd4:dd564:2',
            }),
          },
        ],
      },
      {
        waitFor: [],
        simultaneous: [],
        continueWith: [],
      },
    );
  });

  it('removes all old ids when deleting composed gesture', () => {
    const dom = {} as FiberElement;
    const gestureA = createSerializedGesture(1);
    const gestureB = createSerializedGesture(2);
    const composed = createSerializedComposedGesture([gestureA, gestureB]);

    processGesture(dom, composed as any, undefined, false);
    setAttribute.mockClear();
    setGestureDetector.mockClear();
    removeGestureDetector.mockClear();

    processGesture(dom, undefined as any, composed as any, false);

    expect(setGestureDetector).not.toHaveBeenCalled();
    expect(removeGestureDetector).toHaveBeenCalledTimes(2);
    const removedIds = removeGestureDetector.mock.calls.map(([, id]) => id).sort((a, b) => a - b);
    expect(removedIds).toEqual([1, 2]);
    expect(setAttribute).toHaveBeenCalledWith(dom, 'has-react-gesture', null);
  });

  it('removes stale detector ids before setting when gesture count shrinks on diff', () => {
    const dom = {} as FiberElement;
    const gestureA = createSerializedGesture(1);
    const gestureB = createSerializedGesture(2);
    const oldComposed = createSerializedComposedGesture([gestureA, gestureB]);
    const newSingle = createSerializedGesture(3);

    processGesture(dom, oldComposed as any, undefined, false);
    setAttribute.mockClear();
    setGestureDetector.mockClear();
    removeGestureDetector.mockClear();

    processGesture(dom, newSingle as any, oldComposed as any, false);

    expect(removeGestureDetector).toHaveBeenCalledTimes(2);
    expect(removeGestureDetector).toHaveBeenNthCalledWith(1, dom, 1);
    expect(removeGestureDetector).toHaveBeenNthCalledWith(2, dom, 2);
    expect(setGestureDetector).toHaveBeenCalledTimes(1);
    expect(setGestureDetector).toHaveBeenCalledWith(
      dom,
      3,
      0,
      expect.any(Object),
      {
        waitFor: [],
        simultaneous: [],
        continueWith: [],
      },
    );
  });

  it('consumes old gestures one-to-one when ids are preserved and inserted', () => {
    const dom = {} as FiberElement;
    const oldGestureA = createSerializedGesture(1);
    const oldGestureB = createSerializedGesture(2);
    const newGestureB = createSerializedGesture(2);
    const newGestureC = createSerializedGesture(3);

    oldGestureA.callbacks.onUpdate._wkltId = 'old-a';
    oldGestureB.callbacks.onUpdate._wkltId = 'old-b';
    newGestureB.callbacks.onUpdate._wkltId = 'new-b';
    newGestureC.callbacks.onUpdate._wkltId = 'new-c';

    processGesture(
      dom,
      createSerializedComposedGesture([newGestureB, newGestureC]) as any,
      createSerializedComposedGesture([oldGestureA, oldGestureB]) as any,
      true,
    );

    expect(hydrateCtx).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ _wkltId: 'new-b' }),
      expect.objectContaining({ _wkltId: 'old-b' }),
    );
    expect(hydrateCtx).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ _wkltId: 'new-c' }),
      expect.objectContaining({ _wkltId: 'old-a' }),
    );
  });
});
