// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { SocketConnectOpts } from 'node:net';

import { type Adb, AdbServerClient } from '@yume-chan/adb';
import { AdbServerNodeTcpConnector } from '@yume-chan/adb-server-node-tcp';
import createDebug from 'debug';

import type {
  App,
  Connection,
  Device,
  OpenAppOptions,
  Transport,
  TransportConnectOptions,
} from './transport.ts';

const debug = createDebug('devtool-mcp-server:connector:android');

const KNOWNS_APPS: App[] = [
  { packageName: 'com.lynx.explorer', name: 'Lynx Explorer' },
];

export class AndroidTransport implements Transport {
  #client: AdbServerClient;

  constructor(spec: SocketConnectOpts = { port: 5037 }) {
    this.#client = new AdbServerClient(new AdbServerNodeTcpConnector(spec));
  }

  async #createAdb(deviceId: string): Promise<Adb & AsyncDisposable> {
    const adb = await this.#client.createAdb({ serial: deviceId });
    return Object.assign(adb, {
      async [Symbol.asyncDispose]() {
        await adb.close();
      },
    });
  }

  close(): Promise<void> {
    // noop
    debug('Android transport closed');
    return Promise.resolve();
  }

  async connect(
    { deviceId, port, signal }: TransportConnectOptions,
  ): Promise<Connection> {
    const adb = await this.#client.createAdb({ serial: deviceId });

    debug(`connect: create connection to deviceId: ${deviceId}, port: ${port}`);

    signal?.throwIfAborted();

    const service = `tcp:${port}`;

    let socket: Awaited<ReturnType<Adb['createSocket']>>;
    try {
      socket = await adb.createSocket(service);
    } catch (err) {
      await adb.close();
      debug(`connect: create socket to ${service} failed with err: %o`, err);
      throw err;
    }

    const abortHandler = () => {
      void Promise.resolve(socket.close()).catch((err: unknown) => {
        debug(`connect: socket ${service} close on abort err: %o`, err);
      });
    };
    signal?.addEventListener('abort', abortHandler, { once: true });

    if (signal?.aborted) {
      await socket.close();
      await adb.close();
      signal.throwIfAborted();
    }

    void Promise.resolve(socket.closed).catch((err: unknown) => {
      debug(`connect: socket ${service} closed with err: %o`, err);
    });

    return {
      readable: socket.readable as never,
      writable: socket.writable as never,
      async [Symbol.asyncDispose]() {
        signal?.removeEventListener('abort', abortHandler);
        debug(
          `connect: close connection to deviceId: ${deviceId}, port: ${port}`,
        );
        try {
          await socket.close();
        } finally {
          await adb.close();
        }
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

    return devices.map(({ serial }) => ({
      os: 'Android',
      id: serial,
    }));
  }

  async listAvailableApps(deviceId: string): Promise<App[]> {
    await using adb = await this.#createAdb(deviceId);
    const output = await adb.subprocess.noneProtocol.spawnWaitText([
      // adb shell pm list packages
      'pm',
      'list',
      'packages',
      '-3', // third-party apps only
    ]);
    const packages = new Set(
      output
        .split('\n')
        .map((line) => line.replace('package:', '').trim())
        .filter(i => i !== ''),
    );
    debug(`listAvailableApps all packages: %o`, packages);

    return KNOWNS_APPS.filter((app) => packages.has(app.packageName));
  }

  async openApp(
    deviceId: string,
    packageName: string,
    { withDataCleared }: OpenAppOptions = {},
  ): Promise<void> {
    const apps = await this.listAvailableApps(deviceId);
    await using adb = await this.#createAdb(deviceId);

    if (!apps.some((app) => app.packageName === packageName)) {
      throw new Error(`package ${packageName} not found`);
    }

    if (withDataCleared) {
      const output = await adb.subprocess.noneProtocol.spawnWaitText([
        // adb shell pm clear <package_name>
        'pm',
        'clear',
        packageName,
      ]);
      debug(`openApp clear data output ${output}`);
    }

    const output = await adb.subprocess.noneProtocol.spawnWaitText([
      // adb shell monkey -p <package_name> -c android.intent.category.LAUNCHER 1
      'monkey',
      '-p',
      packageName,
      '-c',
      'android.intent.category.LAUNCHER',
      '1',
    ]);
    debug(`openApp LAUNCHER output ${output}`);
    if (output.includes('No activities found')) {
      throw new Error(
        `No launchable activity found for package ${packageName}.`,
      );
    }
    if (output.includes('monkey aborted')) {
      throw new Error(`Failed to open app ${packageName}.`);
    }
  }
}
