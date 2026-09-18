// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { useEffect } from '../../../src/index';
import { useInsertionEffect } from '../../../compat';
import { setupBackgroundDocument } from '../../../src/document';
import { backgroundSnapshotInstanceManager, setupPage } from '../../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree, waitSchedule } from '../utils/nativeMethod';

describe('useInsertionEffect', () => {
  /** @type {import('../../../src/snapshot').SnapshotInstance} */
  let scratch;

  beforeAll(() => {
    setupBackgroundDocument();
    setupPage(__CreatePage('0', 0));
  });

  beforeEach(() => {
    globalEnvManager.switchToBackground();
    scratch = document.createElement('root');
  });

  afterEach(() => {
    render(null, scratch);
    elementTree.clear();
    backgroundSnapshotInstanceManager.clear();
  });

  it('is useEffect until Preact grows a real insertion phase', () => {
    expect(useInsertionEffect).toBe(useEffect);
  });

  it('runs before a useEffect declared after it', async () => {
    const order = [];

    function Component() {
      useInsertionEffect(() => {
        order.push('insertion');
      }, []);
      useEffect(() => {
        order.push('effect');
      }, []);
      return <view />;
    }

    render(<Component />, scratch);
    await waitSchedule();

    expect(order).toEqual(['insertion', 'effect']);
  });

  it('lets a parent effect read a ref written by a child\'s insertion effect', async () => {
    const optionsRef = { current: null };
    let seenByParent;

    function Child() {
      useInsertionEffect(() => {
        optionsRef.current = 'from child';
      }, []);
      return <view />;
    }

    function Parent() {
      useEffect(() => {
        seenByParent = optionsRef.current;
      }, []);
      return <Child />;
    }

    render(<Parent />, scratch);
    await waitSchedule();

    expect(seenByParent).toBe('from child');
  });

  it('re-runs its cleanup when the dependencies change', async () => {
    const order = [];

    function Component({ value }) {
      useInsertionEffect(() => {
        order.push(`setup:${value}`);
        return () => order.push(`cleanup:${value}`);
      }, [value]);
      return <view />;
    }

    render(<Component value='a' />, scratch);
    await waitSchedule();
    expect(order).toEqual(['setup:a']);

    render(<Component value='b' />, scratch);
    await waitSchedule();
    expect(order).toEqual(['setup:a', 'cleanup:a', 'setup:b']);
  });

  it('does not give React\'s timing guarantees, and these pin that down', async () => {
    const order = [];
    const ref = { current: null };

    function Component() {
      useInsertionEffect(() => {
        ref.current = 'written';
        return () => order.push('cleanup');
      }, []);
      return <view />;
    }

    render(<Component />, scratch);
    // React would have run it inside the commit; here it is still pending.
    expect(ref.current).toBe(null);

    await waitSchedule();
    expect(ref.current).toBe('written');

    render(null, scratch);
    // React would have run the cleanup inside the unmount commit.
    expect(order).toEqual([]);

    await waitSchedule();
    expect(order).toEqual(['cleanup']);
  });
});
