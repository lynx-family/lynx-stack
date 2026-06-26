// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rs, test } from '@rstest/core';

import { MountQueue, PRIORITY } from './mountQueue.js';

describe('MountQueue', () => {
  test('a freshly-registered card is not armed', () => {
    const q = new MountQueue(2);
    q.register('a');
    expect(q.isArmed('a')).toBe(false);
  });

  test('cards stay un-armed at OFFSCREEN priority even with slots free', () => {
    const q = new MountQueue(4);
    q.register('a');
    q.register('b');
    expect(q.isArmed('a')).toBe(false);
    expect(q.isArmed('b')).toBe(false);
  });

  test('cards become armed when promoted to IN_VIEW, up to maxConcurrent', () => {
    const q = new MountQueue(2);
    q.register('a');
    q.register('b');
    q.register('c');
    q.setPriority('a', PRIORITY.IN_VIEW);
    q.setPriority('b', PRIORITY.IN_VIEW);
    q.setPriority('c', PRIORITY.IN_VIEW);
    expect(q.isArmed('a')).toBe(true);
    expect(q.isArmed('b')).toBe(true);
    expect(q.isArmed('c')).toBe(false);
  });

  test('markReady frees the slot and the next pending card becomes armed', () => {
    const q = new MountQueue(1);
    q.register('a');
    q.register('b');
    q.setPriority('a', PRIORITY.IN_VIEW);
    q.setPriority('b', PRIORITY.IN_VIEW);
    expect(q.isArmed('a')).toBe(true);
    expect(q.isArmed('b')).toBe(false);

    q.markReady('a');
    expect(q.isArmed('a')).toBe(true); // armed is sticky
    expect(q.isArmed('b')).toBe(true);
  });

  test('higher priority card wins the next freed slot over a NEAR card', () => {
    const q = new MountQueue(1);
    q.register('hog');
    q.register('near');
    q.register('inview');
    q.setPriority('hog', PRIORITY.IN_VIEW);
    q.setPriority('near', PRIORITY.NEAR);
    q.setPriority('inview', PRIORITY.IN_VIEW);
    expect(q.isArmed('hog')).toBe(true);
    expect(q.isArmed('near')).toBe(false);
    expect(q.isArmed('inview')).toBe(false);

    q.markReady('hog');
    expect(q.isArmed('inview')).toBe(true);
    expect(q.isArmed('near')).toBe(false);
  });

  test('within the same priority tier, registration order breaks ties', () => {
    const q = new MountQueue(1);
    q.register('first');
    q.register('second');
    q.setPriority('first', PRIORITY.IN_VIEW);
    q.setPriority('second', PRIORITY.IN_VIEW);
    expect(q.isArmed('first')).toBe(true);
    expect(q.isArmed('second')).toBe(false);
  });

  test('unregistering an armed-but-not-ready card frees the slot', () => {
    const q = new MountQueue(1);
    q.register('a');
    q.register('b');
    q.setPriority('a', PRIORITY.IN_VIEW);
    q.setPriority('b', PRIORITY.IN_VIEW);
    expect(q.isArmed('a')).toBe(true);
    expect(q.isArmed('b')).toBe(false);

    q.unregister('a');
    expect(q.isArmed('a')).toBe(false);
    expect(q.isArmed('b')).toBe(true);
  });

  test('unregistering a ready card frees the slot for the next pending card', () => {
    const q = new MountQueue(1);
    q.register('a');
    q.register('b');
    q.setPriority('a', PRIORITY.IN_VIEW);
    q.setPriority('b', PRIORITY.IN_VIEW);
    q.markReady('a');
    expect(q.isArmed('b')).toBe(true);
    q.unregister('a');
    // b should remain armed
    expect(q.isArmed('b')).toBe(true);
  });

  test('subscribers are notified when the armed set changes', () => {
    const q = new MountQueue(1);
    const listener = rs.fn();
    q.subscribe(listener);

    q.register('a');
    q.setPriority('a', PRIORITY.IN_VIEW);

    // Should have been called at least once with 'a' in the armed set.
    const calls = listener.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const armed = calls[calls.length - 1][0] as ReadonlySet<string>;
    expect(armed.has('a')).toBe(true);
  });

  test('subscribers do not fire when the armed set does not change', () => {
    const q = new MountQueue(2);
    q.register('a');
    q.setPriority('a', PRIORITY.IN_VIEW);
    const listener = rs.fn();
    q.subscribe(listener);

    // A priority change that does not flip armed state.
    q.setPriority('a', PRIORITY.NEAR);
    expect(listener).not.toHaveBeenCalled();
  });

  test('unsubscribe stops further notifications', () => {
    const q = new MountQueue(1);
    const listener = rs.fn();
    const unsubscribe = q.subscribe(listener);
    unsubscribe();

    q.register('a');
    q.setPriority('a', PRIORITY.IN_VIEW);

    expect(listener).not.toHaveBeenCalled();
  });

  test('demoting from IN_VIEW to OFFSCREEN does not un-arm an already-armed card', () => {
    // Rationale: once an iframe has started loading, dropping its priority
    // shouldn't tear it down — that just wastes the work already in flight.
    const q = new MountQueue(1);
    q.register('a');
    q.setPriority('a', PRIORITY.IN_VIEW);
    expect(q.isArmed('a')).toBe(true);

    q.setPriority('a', PRIORITY.OFFSCREEN);
    expect(q.isArmed('a')).toBe(true);
  });
});
