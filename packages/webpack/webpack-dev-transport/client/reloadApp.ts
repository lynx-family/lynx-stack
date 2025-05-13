// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import hotEmitter from 'webpack/hot/emitter.js';

import type { Options, Status } from './index.js';

declare const NativeModules: {
  // Added in Lynx 3.2
  LynxDevToolSetModule?: LynxDevToolSetModule;

  // Remove in Lynx 3.2
  LynxDevtoolSetModule?: LynxDevtoolSetModule;
};

interface LynxDevToolSetModule {
  // Added in Lynx 3.3
  invokeCdp?: (
    message: string,
    callback: (data?: string) => void,
  ) => void;
}

interface LynxDevtoolSetModule {
  // Theoretically, this method should always available.
  invokeCdp?: (
    type: string,
    message: string,
    callback: (data?: string) => void,
  ) => void;
}

function reloadApp({ hot, liveReload }: Options, status: Status): void {
  const { currentHash, previousHash } = status;
  const isInitial = currentHash.includes(previousHash!);

  if (isInitial) {
    return;
  }

  if (hot) {
    hotEmitter.emit('webpackHotUpdate', status.currentHash);
  } // allow refreshing the page only if liveReload isn't disabled
  else if (liveReload) {
    const intervalId = +setInterval(() => {
      // reload immediately
      applyReload(intervalId);
    }, 10);
  }
}

function applyReload(intervalId: number) {
  clearInterval(intervalId);

  if (
    typeof NativeModules.LynxDevToolSetModule?.invokeCdp !== 'function'
    && typeof NativeModules.LynxDevtoolSetModule?.invokeCdp !== 'function'
  ) {
    console.error('[HMR] live-reload failed: cannot invoke cdp from DevTool.');
    console.error('[HMR] Please reload the page manually.');
    return;
  }

  const invokeCdp = NativeModules.LynxDevToolSetModule?.invokeCdp?.bind(
    NativeModules.LynxDevToolSetModule,
  ) ?? NativeModules.LynxDevtoolSetModule?.invokeCdp?.bind(
    NativeModules.LynxDevtoolSetModule,
    'Page.reload',
  );

  invokeCdp?.(
    JSON.stringify({
      method: 'Page.reload',
      params: {
        ignoreCache: true,
      },
    }),
    (data) => {
      if (!data) {
        return;
      }

      try {
        const { error } = JSON.parse(data) as {
          error?: { message: string; code: number };
        };
        if (error) {
          console.error('[HMR] live-reload failed:', error.message);
        }
      } catch {
        // explicitly ignore error
      }
    },
  );
}

export default reloadApp;
