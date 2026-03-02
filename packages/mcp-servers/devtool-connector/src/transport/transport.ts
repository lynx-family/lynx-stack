// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ReadableStream, WritableStream } from 'node:stream/web';

import type { AppInfo } from '../types.ts';

export interface TransportConnectOptions {
  deviceId: string;
  port: number;
  signal?: AbortSignal | undefined;
}

export interface OpenAppOptions {
  signal?: AbortSignal;
  withDataCleared?: boolean | undefined;
}

export interface Transport {
  close(): Promise<void>;

  listDevices(): Promise<Device[]>;

  listAvailableApps(deviceId: string): Promise<App[]>;

  openApp(
    deviceId: string,
    packageName: string,
    options?: OpenAppOptions,
  ): Promise<void>;

  connect(options: TransportConnectOptions): Promise<Connection>;
}

export interface Device {
  id: string;
  os: 'iOS' | 'Android' | 'Desktop' | 'OpenHarmony';
}

export interface Client {
  id: string;
  info: AppInfo;
}

export interface App {
  packageName: string;
  name: string;
}

export interface Connection extends AsyncDisposable {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
}
