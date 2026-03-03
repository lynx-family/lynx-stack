// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { NetConnectOpts } from 'node:net';
import { Duplex } from 'node:stream';
import type { WritableStream } from 'node:stream/web';

import createDebug from 'debug';
import { UsbmuxClient } from 'usbmux-client';

import type {
  App,
  Connection,
  Device,
  Transport,
  TransportConnectOptions,
} from './transport.ts';

const debug = createDebug('devtool-mcp-server:connector:ios');

export class iOSTransport implements Transport {
  #client: UsbmuxClient;

  constructor(options?: NetConnectOpts) {
    this.#client = new UsbmuxClient(options);
  }

  async close(): Promise<void> {
    await this.#client.close();
    debug('iOS transport closed');
  }

  async connect(
    { deviceId, port, signal }: TransportConnectOptions,
  ): Promise<Connection> {
    debug(`connect: create connection to deviceId: ${deviceId}, port: ${port}`);
    signal?.throwIfAborted();

    const conn = await this.#client.createDeviceTunnel(deviceId, port);

    const abortHandler = () => {
      conn.destroy();
    };
    signal?.addEventListener('abort', abortHandler, { once: true });

    if (signal?.aborted) {
      conn.destroy();
      signal.throwIfAborted();
    }

    const { readable, writable } = Duplex.toWeb(conn);
    return {
      readable,
      writable: writable as WritableStream<Uint8Array>,
      [Symbol.asyncDispose]() {
        signal?.removeEventListener('abort', abortHandler);
        debug(
          `connect: close connection to deviceId: ${deviceId}, port: ${port}`,
        );
        conn.destroy();
        return Promise.resolve();
      },
    };
  }

  async withConnection<T>(
    options: TransportConnectOptions,
    callback: (conn: Connection) => Promise<T>,
  ): Promise<T> {
    await using conn = await this.connect(options);
    return await callback(conn);
  }

  async listDevices(): Promise<Device[]> {
    const devices = await this.#client.getDevices();
    debug('listDevices: devices %o', devices);
    return Object.values(devices).map(({ DeviceID }) => ({
      os: 'iOS',
      id: `${DeviceID}`,
    }));
  }

  listAvailableApps(): Promise<App[]> {
    throw new Error('Not implemented');
  }

  openApp(): Promise<void> {
    throw new Error('Not implemented');
  }
}
