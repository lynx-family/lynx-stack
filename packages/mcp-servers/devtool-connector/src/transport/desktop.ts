// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import net from 'node:net';
import { Duplex } from 'node:stream';

import createDebug from 'debug';

import type {
  App,
  Connection,
  Device,
  Transport,
  TransportConnectOptions,
} from './transport.ts';

const debug = createDebug('devtool-mcp-server:connector:desktop');

export class DesktopTransport implements Transport {
  close(): Promise<void> {
    debug('Desktop transport closed');
    return Promise.resolve();
  }

  listDevices(): Promise<Device[]> {
    return Promise.resolve([{ id: 'localhost', os: 'Desktop' }]);
  }

  listAvailableApps(): Promise<App[]> {
    return Promise.resolve([]);
  }

  openApp(): Promise<void> {
    throw new Error('openApp is not supported on DesktopTransport');
  }

  async connect({
    deviceId,
    port,
    signal,
  }: TransportConnectOptions): Promise<Connection> {
    if (deviceId !== 'localhost') {
      throw new Error(
        `DesktopTransport only supports 'localhost' deviceId, got: ${deviceId}`,
      );
    }

    debug(`connect: connecting to 127.0.0.1:${port}`);

    const socket = net.createConnection({ host: '127.0.0.1', port, signal });

    try {
      if (socket.connecting) {
        await new Promise<void>((resolve, reject) => {
          socket.once('connect', resolve);
          socket.once('error', reject);
        });
      } else {
        // already connected or failed immediately
      }

      debug(`connect: connected to 127.0.0.1:${port}`);

      const { readable, writable } = Duplex.toWeb(socket);
      return {
        readable,
        writable,
        [Symbol.asyncDispose]() {
          debug(`connect: closing connection to 127.0.0.1:${port}`);
          socket.destroy();
          return Promise.resolve();
        },
      };
    } catch (err) {
      debug(`connect: error connecting to 127.0.0.1:${port} %O`, err);
      socket.destroy();
      throw err;
    }
  }
}
