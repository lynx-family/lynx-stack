// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { beforeEach, describe, expect, it, rs } from '@rstest/core';

import { reloadPage } from '../../client/reloadApp.js';
import { startHotDevServer } from '../../client/startHotDevServer.js';

rs.mock('../../client/reloadApp.js', () => ({
  default: rs.fn(),
  reloadPage: rs.fn(),
}));

rs.mock('@rspack/core/hot/log.js', () => ({
  log: rs.fn(),
  formatError: (error: unknown) => String(error),
}));

rs.mock('@rspack/core/hot/log-apply-result.js', () => ({
  logApplyResult: rs.fn(),
}));

describe('startHotDevServer', () => {
  const check = rs.fn();
  const status = rs.fn<() => string>();
  let onHotUpdate: (hash: string) => void;

  const start = () => {
    const hotEmitter = {
      on: rs.fn((_event: string, callback: (...args: unknown[]) => void) => {
        onHotUpdate = callback as (hash: string) => void;
      }),
    };
    startHotDevServer(
      { check, status } as unknown as NonNullable<ImportMeta['webpackHot']>,
      hotEmitter,
      () => 'current-hash',
    );
  };

  beforeEach(() => {
    rs.mocked(reloadPage).mockClear();
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
      await rs.waitFor(() => {
        expect(reloadPage).toBeCalledTimes(1);
      });
    },
  );

  it('should reload when the update is gone from the server', async () => {
    check.mockResolvedValue(null);

    start();
    onHotUpdate('next-hash');
    await rs.waitFor(() => {
      expect(reloadPage).toBeCalledTimes(1);
    });
  });

  it('should not reload while the session can still be updated', async () => {
    check.mockRejectedValue(new Error('transient'));
    status.mockReturnValueOnce('idle').mockReturnValue('idle');

    start();
    onHotUpdate('next-hash');
    await rs.waitFor(() => {
      expect(check).toBeCalled();
    });
    expect(reloadPage).not.toBeCalled();
  });

  it('should not check when already up to date', () => {
    start();
    onHotUpdate('contains current-hash inside');

    expect(check).not.toBeCalled();
  });
});
