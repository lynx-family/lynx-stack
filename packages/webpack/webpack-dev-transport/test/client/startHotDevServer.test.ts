// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { reloadPage } from '../../client/reloadApp.js';
import { startHotDevServer } from '../../client/startHotDevServer.js';
import type { HotUpdateCoordinator } from '../../client/startHotDevServer.js';

vi.mock('../../client/reloadApp.js', () => ({
  default: vi.fn(),
  reloadPage: vi.fn(),
}));

vi.mock('@rspack/core/hot/log.js', () => ({
  log: vi.fn(),
  formatError: (error: Error) => error.message,
}));

vi.mock('@rspack/core/hot/log-apply-result.js', () => ({
  logApplyResult: vi.fn(),
}));

describe('startHotDevServer', () => {
  const check = vi.fn();
  const status = vi.fn<() => string>();
  let onHotUpdate: (hash: string) => void;

  const start = (
    coordinator?: HotUpdateCoordinator,
    getHash = () => 'current-hash',
  ) => {
    const hotEmitter = {
      on: vi.fn((_event: string, callback: (...args: unknown[]) => void) => {
        onHotUpdate = callback as (hash: string) => void;
      }),
    };
    startHotDevServer(
      { check, status } as unknown as NonNullable<ImportMeta['webpackHot']>,
      hotEmitter,
      getHash,
      coordinator,
    );
  };

  beforeEach(() => {
    vi.mocked(reloadPage).mockClear();
    check.mockReset();
    status.mockReset();
    status.mockReturnValue('idle');
  });

  // `apply` moves the session to a terminal state
  it.each(['abort', 'fail'])(
    'should reload when an update cannot be applied (%s)',
    async (terminalStatus) => {
      check.mockRejectedValue(new Error('Module build failed'));
      status.mockReturnValueOnce('idle').mockReturnValue(terminalStatus);

      start();
      onHotUpdate('next-hash');
      await vi.waitFor(() => {
        expect(reloadPage).toBeCalledTimes(1);
      });
    },
  );

  it('should reload when the update is gone from the server', async () => {
    check.mockResolvedValue(null);

    start();
    onHotUpdate('next-hash');
    await vi.waitFor(() => {
      expect(reloadPage).toBeCalledTimes(1);
    });
  });

  it('should not reload while the session can still be updated', async () => {
    check.mockRejectedValue(new Error('transient'));
    status.mockReturnValueOnce('idle').mockReturnValue('idle');

    start();
    onHotUpdate('next-hash');
    await vi.waitFor(() => {
      expect(check).toBeCalled();
    });
    expect(reloadPage).not.toBeCalled();
  });

  it('should not check when already up to date', () => {
    start();
    onHotUpdate('contains current-hash inside');

    expect(check).not.toBeCalled();
  });

  it('keeps ordinary BTS HMR after the captured coordinator reports an unsupported host', async () => {
    vi.useFakeTimers();
    try {
      let complete: (modules: string[]) => void;
      let hash = 'initial';
      const coordinator = {
        prepare: vi.fn().mockResolvedValue(false),
        finish: vi.fn(),
        stop: vi.fn(),
      };
      check.mockImplementationOnce(() =>
        new Promise<string[]>(resolve => {
          complete = resolve;
        })
      );
      start(coordinator, () => hash);
      onHotUpdate('first');
      await vi.advanceTimersByTimeAsync(6000);
      expect(check).toBeCalledTimes(1);
      expect(reloadPage).not.toBeCalled();
      hash = 'first';
      complete!([]);
      await vi.advanceTimersByTimeAsync(0);
      check.mockRejectedValueOnce(new Error('transient BTS download failure'));
      onHotUpdate('second');
      await vi.advanceTimersByTimeAsync(0);
      expect(check).toBeCalledTimes(2);
      expect(coordinator.prepare).toBeCalledTimes(1);
      expect(coordinator.finish).not.toBeCalled();
      expect(coordinator.stop).not.toBeCalled();
      expect(reloadPage).not.toBeCalled();
      check.mockRejectedValueOnce(new Error('unaccepted BTS update'));
      status.mockReturnValueOnce('idle').mockReturnValue('abort');
      onHotUpdate('third');
      await vi.advanceTimersByTimeAsync(0);
      expect(reloadPage).toBeCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
  it('serializes notifications while MTS is preparing and advances an empty BTS update', async () => {
    let release: () => void;
    let hash = 'current-hash';
    const coordinator = {
      prepare: vi.fn(() =>
        new Promise<void>(resolve => {
          release = resolve;
        })
      ),
      finish: vi.fn(),
      stop: vi.fn(),
    };
    check.mockImplementation(() => {
      hash = 'next-hash';
      return Promise.resolve([]);
    });
    start(coordinator, () => hash);
    onHotUpdate('next-hash');
    onHotUpdate('next-hash');
    await vi.waitFor(() => expect(coordinator.prepare).toBeCalledTimes(1));
    expect(check).not.toBeCalled();
    release!();
    await vi.waitFor(() =>
      expect(coordinator.finish).toBeCalledWith('next-hash')
    );
    expect(check).toBeCalledTimes(1);
    expect(reloadPage).not.toBeCalled();
  });

  it('reloads once and stops further checks when a consumed module exception fails the transaction', async () => {
    const coordinator = {
      prepare: vi.fn().mockResolvedValue(undefined),
      finish: vi.fn(() => {
        throw new Error('factory failed');
      }),
      stop: vi.fn(),
    };
    check.mockResolvedValue(['App']);
    start(coordinator);
    onHotUpdate('next-hash');
    await vi.waitFor(() => expect(reloadPage).toBeCalledTimes(1));
    onHotUpdate('another-hash');
    await Promise.resolve();
    expect(check).toBeCalledTimes(1);
    expect(coordinator.stop).toBeCalledTimes(1);
    expect(reloadPage).toBeCalledTimes(1);
  });

  it('applies distinct queued versions in order without duplicate commits', async () => {
    let hash = 'initial';
    const releases: (() => void)[] = [];
    const steps: string[] = [];
    const coordinator = {
      prepare: vi.fn((current: string) => {
        steps.push(`prepare:${current}`);
        return new Promise<void>(resolve => releases.push(resolve));
      }),
      finish: vi.fn((current: string) => steps.push(`finish:${current}`)),
      stop: vi.fn(),
    };
    check.mockImplementation(() => {
      hash = hash === 'initial' ? 'first' : 'second';
      steps.push(`apply:${hash}`);
      return Promise.resolve([]);
    });
    start(coordinator, () => hash);
    onHotUpdate('first');
    await vi.waitFor(() => expect(releases).toHaveLength(1));
    onHotUpdate('second');
    onHotUpdate('second');
    releases[0]!();
    await vi.waitFor(() => expect(releases).toHaveLength(2));
    expect(steps).toEqual([
      'prepare:initial',
      'apply:first',
      'finish:first',
      'prepare:first',
    ]);
    releases[1]!();
    await vi.waitFor(() => expect(coordinator.finish).toBeCalledTimes(2));
    expect(steps).toEqual([
      'prepare:initial',
      'apply:first',
      'finish:first',
      'prepare:first',
      'apply:second',
      'finish:second',
    ]);
    expect(check).toBeCalledTimes(2);
    expect(reloadPage).not.toBeCalled();
  });

  it.each([null, 0, undefined])(
    'reloads when BTS rejects with a non-Error value: %s',
    async (reason) => {
      check.mockRejectedValue(reason);
      const coordinator = {
        prepare: vi.fn().mockResolvedValue(undefined),
        finish: vi.fn(),
        stop: vi.fn(),
      };
      start(coordinator);
      onHotUpdate('next');
      await vi.waitFor(() => expect(reloadPage).toBeCalledTimes(1));
      expect(coordinator.stop).toBeCalledTimes(1);
    },
  );

  it('reloads on a missing MTS completion before starting BTS apply', async () => {
    const coordinator = {
      prepare: vi.fn().mockRejectedValue(new Error('completion timed out')),
      finish: vi.fn(),
      stop: vi.fn(),
    };
    start(coordinator);
    onHotUpdate('next-hash');
    await vi.waitFor(() => expect(reloadPage).toBeCalledTimes(1));
    expect(check).not.toBeCalled();
    expect(coordinator.finish).not.toBeCalled();
    expect(coordinator.stop).toBeCalledTimes(1);
  });

  it('bounds BTS apply and ignores a late completion after reload', async () => {
    vi.useFakeTimers();
    try {
      let complete: (modules: string[]) => void;
      const coordinator = {
        prepare: vi.fn().mockResolvedValue(undefined),
        finish: vi.fn(),
        stop: vi.fn(),
      };
      check.mockImplementation(() =>
        new Promise<string[]>(resolve => {
          complete = resolve;
        })
      );
      start(coordinator);
      onHotUpdate('next-hash');
      await vi.advanceTimersByTimeAsync(9999);
      expect(reloadPage).not.toBeCalled();
      expect(coordinator.stop).not.toBeCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(reloadPage).toBeCalledTimes(1);
      expect(coordinator.stop).toBeCalledTimes(1);
      complete!(['late']);
      await vi.advanceTimersByTimeAsync(0);
      expect(coordinator.finish).not.toBeCalled();
      expect(reloadPage).toBeCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
