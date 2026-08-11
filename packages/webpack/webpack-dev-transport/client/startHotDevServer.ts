// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/*
  Derived from `@rspack/core/hot/dev-server.js`

  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra

  The upstream module recovers from a failed `apply` with
  `window.location.reload()`, which Lynx does not have. Without it the HMR
  session stays in `abort` or `fail` forever and every later edit is silently
  ignored, so this reloads through the DevTool instead.
*/

import { logApplyResult } from '@rspack/core/hot/log-apply-result.js';
import { formatError, log } from '@rspack/core/hot/log.js';

import { reloadPage } from './reloadApp.js';

type WebpackHot = NonNullable<ImportMeta['webpackHot']>;

interface HotEmitter {
  on(eventName: string, callback: (...args: unknown[]) => void): void;
}

function startHotDevServer(
  webpackHot: WebpackHot,
  hotEmitter: HotEmitter,
  getCurrentHash: () => string,
): void {
  let lastHash: string | undefined;

  const upToDate = () => (lastHash ?? '').includes(getCurrentHash());

  const check = () => {
    webpackHot
      .check(true)
      .then((updatedModules) => {
        if (!updatedModules) {
          log('warning', '[HMR] Cannot find update. Need to do a full reload!');
          log(
            'warning',
            '[HMR] (Probably because of restarting the rspack-dev-server)',
          );
          reloadPage();
          return;
        }

        if (!upToDate()) {
          check();
        }

        logApplyResult(updatedModules, updatedModules);

        if (upToDate()) {
          log('info', '[HMR] App is up to date.');
        }
      })
      .catch((err: unknown) => {
        const status = webpackHot.status();
        // `abort` and `fail` are terminal: the session can never apply another
        // update, so reloading is the only way back.
        if (status === 'abort' || status === 'fail') {
          log(
            'warning',
            '[HMR] Cannot apply update. Need to do a full reload!',
          );
          log('warning', `[HMR] ${formatError(err)}`);
          reloadPage();
        } else {
          log('warning', `[HMR] Update failed: ${formatError(err)}`);
        }
      });
  };

  hotEmitter.on('webpackHotUpdate', (currentHash) => {
    lastHash = currentHash as string;
    if (!upToDate() && webpackHot.status() === 'idle') {
      log('info', '[HMR] Checking for updates on the server...');
      check();
    }
  });

  log('info', '[HMR] Waiting for update signal from WDS...');
}

export { startHotDevServer };
