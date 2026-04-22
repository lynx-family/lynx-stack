import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { prepareGestureForCommit } from '../../../src/snapshot/gesture/processGestureBagkround';
import { clearConfigCacheForTesting } from '../../../src/snapshot/worklet/functionality';

describe('prepareGestureForCommit', () => {
  let previousSdkVersion;

  beforeEach(() => {
    previousSdkVersion = SystemInfo.lynxSdkVersion;
    SystemInfo.lynxSdkVersion = '2.14';
    clearConfigCacheForTesting();
  });

  afterEach(() => {
    SystemInfo.lynxSdkVersion = previousSdkVersion;
    clearConfigCacheForTesting();
  });

  it('does not mutate input gesture and supports non-object callbacks', () => {
    const gesture = {
      id: 1,
      type: 0,
      callbacks: {
        onUpdate: null,
      },
      __isGesture: true,
      toJSON() {
        const { toJSON, ...rest } = this;
        return {
          ...rest,
          __isSerialized: true,
        };
      },
    };

    const committed = prepareGestureForCommit(gesture);
    expect(committed).not.toBe(gesture);
    expect(committed.callbacks).not.toBe(gesture.callbacks);
    expect(committed.callbacks.onUpdate).toBe(null);

    expect(committed.toJSON).not.toBe(gesture.toJSON);

    // Gesture runtime provides toJSON; ensure the committed object still serializes.
    const json = committed.toJSON();
    expect(json.__isSerialized).toBe(true);
  });

  it('serializes committed callbacks even when the source toJSON closes over the original gesture', () => {
    const gesture = {
      id: 1,
      type: 0,
      callbacks: {
        onUpdate: {
          _wkltId: 'bdd4:dd564:2',
        },
      },
      waitFor: [],
      simultaneousWith: [],
      continueWith: [],
      __isGesture: true,
    };
    gesture.toJSON = () => ({
      id: gesture.id,
      type: gesture.type,
      callbacks: gesture.callbacks,
      waitFor: [],
      simultaneousWith: [],
      continueWith: [],
      __isSerialized: true,
    });

    const committed = prepareGestureForCommit(gesture);
    const json = committed.toJSON();

    expect(committed.callbacks.onUpdate).toEqual({
      _wkltId: 'bdd4:dd564:2',
    });
    expect(committed.callbacks.onUpdate).not.toBe(gesture.callbacks.onUpdate);
    expect(json.callbacks.onUpdate).toEqual({
      _wkltId: 'bdd4:dd564:2',
    });
    expect(json.callbacks.onUpdate).not.toBe(gesture.callbacks.onUpdate);
    expect(json.callbacks.onUpdate).toBe(committed.callbacks.onUpdate);
  });
});
