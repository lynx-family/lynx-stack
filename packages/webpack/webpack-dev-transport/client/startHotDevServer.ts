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

interface HotUpdateCoordinator {
  // `false` disables coordination when the host cannot load main-thread updates.
  // biome-ignore lint/suspicious/noConfusingVoidType: Existing coordinators return Promise<void>; false is an optional opt-out.
  prepare(hash: string): Promise<void | false>;
  finish(hash: string): void;
  stop(): void;
}

function startHotDevServer(
  webpackHot: WebpackHot,
  hotEmitter: HotEmitter,
  getCurrentHash: () => string,
  coordinator?: HotUpdateCoordinator,
): void {
  let lastHash: string | undefined;
  let checking = false;
  let reloading = false;

  const reload = () => {
    if (reloading) return;
    reloading = true;
    coordinator?.stop();
    reloadPage();
  };

  const upToDate = () => (lastHash ?? '').includes(getCurrentHash());

  const check = () => {
    if (checking || reloading) return;
    checking = true;
    Promise.resolve()
      .then(() => coordinator?.prepare(getCurrentHash()))
      .then((prepared) => {
        if (prepared === false) coordinator = undefined;
        const application = webpackHot.check(true);
        if (!coordinator) return application;
        let timer: ReturnType<typeof setTimeout>;
        return Promise.race([
          application,
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => {
              reject(new Error('Background HMR application timed out'));
            }, 10000);
          }),
        ]).finally(() => clearTimeout(timer));
      })
      .then((updatedModules) => {
        if (reloading) return;
        if (!updatedModules) {
          log('warning', '[HMR] Cannot find update. Need to do a full reload!');
          log(
            'warning',
            '[HMR] (Probably because of restarting the rspack-dev-server)',
          );
          reload();
          return;
        }

        coordinator?.finish(getCurrentHash());
        checking = false;

        if (!upToDate()) {
          check();
        }

        logApplyResult(updatedModules, updatedModules);

        if (upToDate()) {
          log('info', '[HMR] App is up to date.');
        }
      })
      .catch((err: unknown) => {
        checking = false;
        const error = err instanceof Error ? err : new Error(String(err));
        const status = webpackHot.status();
        // `abort` and `fail` are terminal: the session can never apply another
        // update, so reloading is the only way back.
        if (coordinator || status === 'abort' || status === 'fail') {
          log(
            'warning',
            '[HMR] Cannot apply update. Need to do a full reload!',
          );
          log('warning', `[HMR] ${formatError(error)}`);
          reload();
        } else {
          log('warning', `[HMR] Update failed: ${formatError(error)}`);
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
export type { HotUpdateCoordinator };
