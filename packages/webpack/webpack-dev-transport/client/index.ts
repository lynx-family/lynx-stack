// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createSocketURL } from './createSocketURL.js';
import { log, logEnabledFeatures } from './log.js';
import { parseURL } from './parseURL.js';
import reloadApp from './reloadApp.js';
import socket from './socket.js';
import { LynxTransportClient } from './transport.js';

export interface Options {
  hot: boolean;
  liveReload: boolean;
  progress: boolean;
  logging?: string;
  reconnect?: number;
}

export interface Status {
  isReconnecting: boolean;
  currentHash: string;
  previousHash?: string;
}

const status: Status = {
  isReconnecting: false,
  currentHash: __webpack_hash__,
};

const enabledFeatures = {
  'Hot Module Replacement': false,
  'Live Reloading': false,
  Progress: false,
  Overlay: false,
};

const options: Options = {
  hot: false,
  liveReload: false,
  progress: false,
};

const parsedResourceQuery = parseURL(__resourceQuery);

const token = parsedResourceQuery['token'];

if (parsedResourceQuery['hot'] === 'true') {
  options.hot = true;
  enabledFeatures['Hot Module Replacement'] = true;
}

if (parsedResourceQuery['live-reload'] === 'true') {
  options.liveReload = true;
  enabledFeatures['Live Reloading'] = true;
}

if (parsedResourceQuery['progress'] === 'true') {
  options.progress = true;
  enabledFeatures.Progress = true;
}

logEnabledFeatures(enabledFeatures);

const onSocketMessage = {
  hot() {
    if (parsedResourceQuery['hot'] === 'false') {
      return;
    }

    options.hot = true;
  },
  liveReload() {
    if (parsedResourceQuery['live-reload'] === 'false') {
      return;
    }

    options.liveReload = true;
  },
  invalid() {
    log.info('App updated. Recompiling...');
  },
  hash(hash: string) {
    if (status.isReconnecting) {
      // We only need this once when reconnecting
      status.isReconnecting = false;

      // Here, we not only override the currentHash, but also override the
      // previousHash and the hash in webpack runtime.
      // In this way, we reset all the hash-related runtime status to match
      // the cold start.
      status.currentHash = status.previousHash = hash;
      // @ts-expect-error webpack runtime hack
      /* webpack/runtime/getFullHash */ __webpack_require__.h = function() {
        return hash;
      };
      return;
    }

    status.previousHash = status.currentHash;
    status.currentHash = hash;
  },
  reconnect(value: number) {
    if (parsedResourceQuery['reconnect'] === 'false') {
      return;
    }

    options.reconnect = value;
  },
  progress(value: boolean) {
    options.progress = value;
  },
  'still-ok': function stillOk() {
    log.info('Nothing changed.');
  },
  ok() {
    reloadApp(options, status);
  },
  warnings(_warnings: Error[], params?: { preventReloading: boolean }) {
    // TODO: format warnings
    if (params?.preventReloading) {
      return;
    }

    reloadApp(options, status);
  },
  'static-changed': function staticChanged(file?: string) {
    log.info(
      `${
        file ? `"${file}"` : 'Content'
      } from static directory was changed. Reloading...`,
    );
    reloadApp({ liveReload: true, hot: false, progress: false }, status);
  },

  errors(_errors: Error[]) {
    log.error('Errors while compiling. Reload prevented.');
    // TODO: format errors
  },
  error(error: Error) {
    log.error(error.toString());
  },
  close() {
    // When the dev-server disconnected, we set `isReconnecting` to allow
    // override the webpack hash when dev-server restart and connect to client.
    status.isReconnecting = true;
    log.info('Disconnected!');
  },
};

const socketURL = createSocketURL(
  parsedResourceQuery as unknown as URL,
  token as string,
);

// @ts-expect-error I don't know TypeScript. I can't make it work :(
socket(socketURL, onSocketMessage, options.reconnect);

// Export the transport client so that it can be used in the `devServer.client.webSocketTransport`
export default LynxTransportClient;
export type { Client } from './transport.js';
