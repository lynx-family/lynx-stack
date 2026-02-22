import { describe, expect, it } from 'vitest';

import { prepareGestureForCommit } from '../../src/gesture/processGestureBagkround';

describe('prepareGestureForCommit', () => {
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

    // Committed payload should serialize itself, not rely on the original object's toJSON.
    const json = committed.toJSON();
    expect(json.__isSerialized).toBe(true);
  });
});
