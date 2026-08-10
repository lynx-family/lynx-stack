// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { log } from '../../client/log.js';
import { logBuildErrors } from '../../client/logBuildErrors.js';

describe('logBuildErrors', () => {
  // `log` binds `console.error` at module load, so spying on `console` itself
  // would not be observed.
  const logError = vi.spyOn(log, 'error').mockReturnValue(undefined);

  beforeEach(() => {
    logError.mockClear();
  });

  it('should log errors sent by Rsbuild', () => {
    logBuildErrors({ text: ['SassError: expected ")".'], html: '<div />' });

    expect(logError).toBeCalledWith(
      'Errors while compiling. Reload prevented.',
    );
    expect(logError).toBeCalledWith('SassError: expected ")".');
  });

  it('should log errors sent by webpack-dev-server', () => {
    logBuildErrors([new Error('Module not found')]);

    expect(logError).toBeCalledWith('Error: Module not found');
  });

  it('should strip the terminal colors', () => {
    logBuildErrors({
      text: [
        '\u001B[31m\u00D7 \u001B[0m\u001B[1mModule build failed\u001B[22m',
      ],
    });

    expect(logError).toBeCalledWith('× Module build failed');
  });

  it('should strip a reset sequence with no parameters', () => {
    logBuildErrors({ text: ['\u001B[mplain'] });

    expect(logError).toBeCalledWith('plain');
  });

  it('should truncate when there are too many errors', () => {
    logBuildErrors({ text: ['1', '2', '3', '4', '5', '6', '7'] });

    expect(logError).toBeCalledWith('5');
    expect(logError).not.toBeCalledWith('6');
    expect(logError).toBeCalledWith(
      'Additional errors detected. View complete log in terminal for details.',
    );
  });

  it('should still log when there is no error text', () => {
    logBuildErrors(undefined);

    expect(logError).toBeCalledTimes(1);
    expect(logError).toBeCalledWith(
      'Errors while compiling. Reload prevented.',
    );
  });
});
