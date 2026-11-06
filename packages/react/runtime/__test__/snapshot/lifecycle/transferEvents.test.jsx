// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, expect, it, vi } from 'vitest';

import { delayedPublishEvent, delayedEvents } from '../../../src/snapshot/lifecycle/event/delayEvents';
import { backgroundSnapshotInstanceManager } from '../../../src/snapshot/snapshot/backgroundSnapshot';
import { installTransferEventHandlers } from '../../../src/snapshot/transfer-events';

let events;
afterEach(() => {
  events?.dispose();
  events = undefined;
  delayedEvents?.splice(0);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('dispatches native events without ordinary page first-screen hydration', () => {
  const oldPublish = vi.fn();
  const oldComponent = vi.fn();
  const app = { publishEvent: oldPublish, publicComponentEvent: oldComponent };
  vi.stubGlobal('lynx', { ...lynx, getApp: () => app });
  const callback = vi.fn();
  vi.spyOn(backgroundSnapshotInstanceManager, 'getValueBySign').mockReturnValue(callback);
  events = installTransferEventHandlers();
  const event = { type: 'tap' };
  app.publishEvent('10:0:', event);
  app.publicComponentEvent('component', '10:0:', event);
  expect(callback).toHaveBeenCalledTimes(2);
  expect(oldPublish).not.toHaveBeenCalled();
  expect(oldComponent).not.toHaveBeenCalled();
  events.dispose();
  expect(app.publishEvent).toBe(oldPublish);
  expect(app.publicComponentEvent).toBe(oldComponent);
});

it('runs before-publish hooks and reports handler errors without queueing', () => {
  const beforePublish = vi.fn();
  const app = { publishEvent: vi.fn(), publicComponentEvent: vi.fn(), callBeforePublishEvent: beforePublish };
  const reportError = vi.fn();
  vi.stubGlobal('lynx', { ...lynx, getApp: () => app, reportError });
  const throwing = vi.fn(() => {
    throw new Error('event handler boom');
  });
  const resolve = vi.spyOn(backgroundSnapshotInstanceManager, 'getValueBySign').mockReturnValue(throwing);
  events = installTransferEventHandlers();
  const event = { type: 'tap' };
  app.publishEvent('10:1:', event);
  expect(beforePublish).toHaveBeenCalledOnce();
  expect(beforePublish).toHaveBeenCalledWith(event);
  expect(throwing).toHaveBeenCalledOnce();
  expect(reportError).toHaveBeenCalledOnce();
  expect(reportError.mock.calls[0][0]).toBeInstanceOf(Error);
  // The event was dispatched (despite the error), so it is not queued for a
  // later flush.
  events.flush();
  expect(resolve).toHaveBeenCalledTimes(1);
});

it('replays events queued before the transfer snapshot is hydrated', () => {
  const app = { publishEvent: delayedPublishEvent, publicComponentEvent: vi.fn() };
  vi.stubGlobal('lynx', { ...lynx, getApp: () => app });
  const callback = vi.fn();
  const resolve = vi.spyOn(backgroundSnapshotInstanceManager, 'getValueBySign').mockReturnValue(null);
  const event = { type: 'tap' };
  app.publishEvent('10:0:', event);
  events = installTransferEventHandlers();
  app.publishEvent('11:0:', event);
  events.flush();
  expect(callback).not.toHaveBeenCalled();
  resolve.mockReturnValue(callback);
  events.flush();
  expect(callback).toHaveBeenCalledTimes(2);
  events.flush();
  expect(callback).toHaveBeenCalledTimes(2);
});
