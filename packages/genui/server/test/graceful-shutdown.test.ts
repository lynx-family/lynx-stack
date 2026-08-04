// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { EventEmitter } from 'node:events';

import type { ServerType } from '@hono/node-server';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core';

import { createGracefulShutdown } from '../src/graceful-shutdown.js';

class MockServer extends EventEmitter {
  public closeCallback: (() => void) | undefined;

  public close(callback: () => void): this {
    this.closeCallback = callback;
    return this;
  }
}

class MockConnection extends EventEmitter {
  public destroy(): this {
    this.emit('close');
    return this;
  }
}

describe('graceful shutdown', () => {
  beforeEach(() => {
    rstest.useFakeTimers();
  });

  afterEach(() => {
    rstest.useRealTimers();
  });

  test('force-closes long-lived connections after the grace period', async () => {
    const server = new MockServer();
    const connection = new MockConnection();
    const close = rstest.spyOn(server, 'close');
    const destroy = rstest.spyOn(connection, 'destroy');
    const logger = {
      info: rstest.fn(),
      warn: rstest.fn(),
    };
    const shutdown = createGracefulShutdown(
      server as unknown as ServerType,
      { gracePeriodMs: 100, logger },
    );
    server.emit('connection', connection);

    shutdown('SIGTERM');
    shutdown('SIGINT');
    expect(close).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();

    await rstest.advanceTimersByTimeAsync(100);

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'Graceful shutdown timed out; forcing connection close',
    );

    server.closeCallback?.();
    server.closeCallback?.();
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenLastCalledWith('GenUI server stopped');
  });

  test('cancels forced closure when connections drain normally', async () => {
    const server = new MockServer();
    const connection = new MockConnection();
    const destroy = rstest.spyOn(connection, 'destroy');
    const logger = {
      info: rstest.fn(),
      warn: rstest.fn(),
    };
    const shutdown = createGracefulShutdown(
      server as unknown as ServerType,
      { gracePeriodMs: 100, logger },
    );
    server.emit('connection', connection);

    shutdown('SIGTERM');
    server.closeCallback?.();
    await rstest.advanceTimersByTimeAsync(100);

    expect(destroy).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenLastCalledWith('GenUI server stopped');
  });
});
