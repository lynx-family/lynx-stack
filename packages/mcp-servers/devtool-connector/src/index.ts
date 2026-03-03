// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { randomInt } from 'node:crypto';
import { ReadableStream, type TransformStream } from 'node:stream/web';

import createDebug from 'debug';

import {
  CDPOutputTransformStream,
  CDPRequestTransformStream,
  CDPResponseTransformStream,
} from './streams/cdp.ts';
import {
  AppResponseTransformStream,
  CustomizedRequestTransformStream,
  CustomizedResponseTransformStream,
  GlobalSwitchRequestTransformStream,
} from './streams/customized.ts';
import {
  MessageToPeertalkTransformStream,
  PeertalkToMessageTransformStream,
} from './streams/peertalk.ts';
import { FilterTransformStream, InspectStream } from './streams/utils.ts';
import { takeoverDebugRouterLock } from './takeover.ts';
import type {
  App,
  Client,
  Device,
  OpenAppOptions,
  Transport,
  TransportConnectOptions,
} from './transport/transport.ts';
import { isInitializeResponse, isListSessionResponse } from './types.ts';
import type {
  AppInfo,
  CDPRequestMessage,
  GetGlobalSwitchResponse,
  GlobalKeys,
  InitializeRequest,
  InitializeResponse,
  ListSessionRequest,
  ListSessionResponse,
  Session,
} from './types.ts';

export { MessageToPeertalkTransformStream, PeertalkToMessageTransformStream };

const debug = createDebug('devtool-mcp-server:connector');

interface OutputStream<O> extends AsyncDisposable, ReadableStream<O> {}

export class ClientId {
  static serialize(deviceId: string, port: number): string {
    return `${encodeURIComponent(deviceId)}:${port}`;
  }

  static deserialize(
    clientId: string,
  ): { deviceId: string; port: number } | null {
    try {
      const lastColonIndex = clientId.lastIndexOf(':');
      if (lastColonIndex === -1) return null;

      const port = Number.parseInt(clientId.substring(lastColonIndex + 1), 10);
      if (Number.isNaN(port)) return null;

      return {
        deviceId: decodeURIComponent(clientId.substring(0, lastColonIndex)),
        port,
      };
    } catch {
      return null;
    }
  }
}

interface Pipeline {
  input: TransformStream[];
  output: TransformStream[];
}

export class Connector {
  #transports: Transport[];

  constructor(transports: Transport[]) {
    this.#transports = transports;
  }

  async listClients(): Promise<Client[]> {
    const transportDevices = await Promise.allSettled(
      this.#transports.map(async (transport) => ({
        transport,
        devices: await transport.listDevices(),
      })),
    );

    const results = await Promise.allSettled(
      transportDevices
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
        .flatMap(({ transport, devices }) =>
          devices.flatMap(({ id }) => this.#listClientsForDevice(transport, id))
        ),
    );

    return results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value);
  }

  async listDevices(): Promise<Device[]> {
    const results = await Promise.allSettled(
      this.#transports.map(t => t.listDevices()),
    );

    return results
      .filter(result => result.status === 'fulfilled')
      .flatMap(({ value }) => value);
  }

  async listAvailableApps(deviceId: string): Promise<App[]> {
    const transport = await this.#findTransportWithDeviceId(deviceId);

    return await transport.listAvailableApps(deviceId);
  }

  async openApp(
    deviceId: string,
    packageName: string,
    options?: OpenAppOptions,
  ): Promise<void> {
    const transport = await this.#findTransportWithDeviceId(deviceId);

    await transport.openApp(deviceId, packageName, options);

    const signal = AbortSignal.any([
      options?.signal,
      AbortSignal.timeout(60_000),
    ].filter(i => i !== undefined));

    const { setTimeout } = await import('node:timers/promises');
    while (!signal.aborted) {
      try {
        const clients = await this.#listClientsForDevice(transport, deviceId);

        if (
          clients.some(({ info }) =>
            /** Android */ info.AppProcessName === packageName
              /** iOS */ || info.bundleId === packageName
              /** OpenHarmony */ || info.bundleName === packageName
          )
        ) {
          break;
        }
      } catch (err) {
        // ignore error
        debug(`openApp ${deviceId} ${packageName} client not found %o`, err);
      }
      await setTimeout(1_000);
    }
  }

  async sendMessage<T, R>(clientId: string, message: T): Promise<R> {
    return await this.#sendMessage(clientId, message);
  }

  async sendAppMessage<Output, Params = never>(
    clientId: string,
    method: string,
    params?: Params,
  ): Promise<Output> {
    const { port } = this.#resolveClientId(clientId);
    const id = randomInt(10_000, 50_000);

    return await this.#sendMessage<Record<string, unknown>, Output>(clientId, {
      method,
      params: /** App message requires params to be an object */ { ...params },
    }, {
      input: [
        new CustomizedRequestTransformStream({
          type: 'App',
          port,
          sessionId: -1,
          messageBuilder: (message) => ({ id, ...message }),
        }),
      ],
      output: [
        new CustomizedResponseTransformStream('App', id),
        new AppResponseTransformStream(method),
      ],
    });
  }

  async sendCDPMessage<Output, Params = never>(
    clientId: string,
    sessionId: number,
    method: string,
    params?: Params,
  ): Promise<Output> {
    const { port } = this.#resolveClientId(clientId);
    const id = randomInt(10_000, 50_000);

    return await this.#sendMessage<Record<string, unknown>, Output>(clientId, {
      method,
      params,
      sessionId,
    }, {
      input: [
        new CDPRequestTransformStream(port, id),
      ],
      output: [
        new CDPResponseTransformStream(id),
        new CDPOutputTransformStream(),
      ],
    });
  }

  async sendListSessionMessage(
    clientId: string,
  ): Promise<Session[]> {
    const options = this.#resolveClientId(clientId);
    const { data: { data: sessions } } = await this.#sendMessage<
      ListSessionRequest,
      ListSessionResponse
    >(
      clientId,
      {
        event: 'Customized',
        data: {
          type: 'ListSession',
          sender: options.port,
          data: {},
        },
      },
      {
        input: [],
        output: [
          new FilterTransformStream(isListSessionResponse),
        ],
      },
    );

    return sessions;
  }

  async getGlobalSwitch(
    clientId: string,
    key: GlobalKeys,
  ): Promise<boolean> {
    const options = this.#resolveClientId(clientId);
    const {
      data: { data: { message } },
    } = await this.#sendMessage<{ key: GlobalKeys }, GetGlobalSwitchResponse>(
      clientId,
      { key },
      {
        input: [
          new GlobalSwitchRequestTransformStream(
            'GetGlobalSwitch',
            options.port,
          ),
        ],
        output: [],
      },
    );

    if (typeof message === 'object') {
      return message?.global_value === 'true' || message?.global_value === true;
    } else {
      return message === 'true' || message === true;
    }
  }

  async setGlobalSwitch(
    clientId: string,
    key: GlobalKeys,
    value: boolean,
  ): Promise<void> {
    const options = this.#resolveClientId(clientId);
    await this.#sendMessage(clientId, { key, value }, {
      input: [
        new GlobalSwitchRequestTransformStream('SetGlobalSwitch', options.port),
      ],
      output: [],
    });
  }

  async sendStream<I, O>(
    clientId: string,
    inputStream: ReadableStream<I>,
    { signal }: { signal?: AbortSignal },
  ): Promise<OutputStream<O>> {
    const { deviceId, port } = this.#resolveClientId(clientId);
    const transport = await this.#findTransportWithDeviceId(deviceId);

    return await this.#connect(
      transport,
      { deviceId, port, signal },
      inputStream,
      { input: [], output: [] },
    );
  }

  async sendCDPStream(
    clientId: string,
    inputStream: ReadableStream<CDPRequestMessage & { sessionId: number }>,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<OutputStream<CDPRequestMessage>> {
    const { deviceId, port } = this.#resolveClientId(clientId);
    const transport = await this.#findTransportWithDeviceId(deviceId);

    return await this.#connect(
      transport,
      { deviceId, port, signal },
      inputStream,
      {
        input: [
          new CDPRequestTransformStream(port),
        ],
        output: [
          new CDPResponseTransformStream<CDPRequestMessage>(),
        ],
      },
    );
  }

  #resolveClientId(clientId: string): TransportConnectOptions {
    const parsed = ClientId.deserialize(clientId);
    if (!parsed) {
      throw new Error(`Invalid clientId: ${clientId}`);
    }
    return parsed;
  }

  async #findTransportWithDeviceId(deviceId: string): Promise<Transport> {
    return await Promise.any(
      this.#transports.map(async (t) => {
        const devices = await t.listDevices();
        if (devices.some(({ id }) => id === deviceId)) return t;
        throw new Error('Not found in this transport');
      }),
    ).catch(() => {
      throw new Error(`Device with id: ${deviceId} not found`);
    });
  }

  async #connect<I, O>(
    transport: Transport,
    options: TransportConnectOptions,
    inputStream: ReadableStream<I>,
    pipeline: Pipeline,
  ): Promise<OutputStream<O>> {
    const { deviceId, port } = options;

    await takeoverDebugRouterLock();

    const conn = await transport.connect(options);

    void [
      ...pipeline.input,
      new InspectStream((msg) =>
        debug(`connect ${deviceId}:${port} input stream send %O`, msg)
      ),
      new MessageToPeertalkTransformStream(),
    ].reduce((stream, transform) => stream.pipeThrough(transform), inputStream)
      .pipeTo(conn.writable, { preventClose: true })
      .catch((err) => {
        debug(`connect ${deviceId}:${port} input stream err %O`, err);
        void conn[Symbol.asyncDispose]();
      });

    const outputStream = [
      new PeertalkToMessageTransformStream(),
      new InspectStream((msg) =>
        debug(`connect ${deviceId}:${port} output stream receive %O`, msg)
      ),
      ...pipeline.output,
    ].reduce(
      (stream, transform) => stream.pipeThrough(transform),
      conn.readable,
    );

    return Object.assign(outputStream, {
      async [Symbol.asyncDispose]() {
        debug(`connect ${deviceId}:${port} close connection`);
        return await conn[Symbol.asyncDispose]();
      },
    });
  }

  async #sendMessage<I, O>(
    clientId: string,
    input: I,
    pipeline: Pipeline = { input: [], output: [] },
  ): Promise<O> {
    const { deviceId, port } = this.#resolveClientId(clientId);
    const transport = await this.#findTransportWithDeviceId(deviceId);

    const signal = AbortSignal.timeout(5000);

    return this.#sendMessageWithTransport(
      transport,
      { deviceId, port, signal },
      input,
      pipeline,
    );
  }

  async #sendMessageWithTransport<I, O>(
    transport: Transport,
    options: TransportConnectOptions,
    input: I,
    pipeline: Pipeline,
  ): Promise<O> {
    await using outputStream = await this.#connect<I, O>(
      transport,
      options,
      ReadableStream.from([input]),
      pipeline,
    );
    for await (const response of outputStream) {
      return response;
    }

    const { deviceId, port } = options;
    throw new Error(
      `No response found for deviceId: ${deviceId} port: ${port}`,
    );
  }

  async #listClientsForDevice(
    transport: Transport,
    deviceId: string,
  ): Promise<{ id: string; info: AppInfo; port: number }[]> {
    const MIN_PORT = 8901;
    const PORTS = Array.from({ length: 10 }, (_, i) => MIN_PORT + i);
    const results = await Promise.allSettled(PORTS.map(async (port) => {
      const { data: { info } } = await this.#sendMessageWithTransport<
        InitializeRequest,
        InitializeResponse
      >(
        transport,
        { deviceId, port, signal: AbortSignal.timeout(5_000) },
        { event: 'Initialize', data: port },
        {
          input: [],
          output: [
            new FilterTransformStream(isInitializeResponse),
          ],
        },
      );

      try {
        await this.#sendMessageWithTransport<
          { key: GlobalKeys; value: boolean },
          never
        >(
          transport,
          { deviceId, port, signal: AbortSignal.timeout(3_000) },
          { key: 'enable_devtool', value: true },
          {
            input: [
              new GlobalSwitchRequestTransformStream('SetGlobalSwitch', port),
            ],
            output: [],
          },
        );
      } catch (err) {
        debug(
          `listClientsForDevice ${deviceId}:${port} enable_devtool failed %O`,
          err,
        );
      }

      return { id: ClientId.serialize(deviceId, port), info, port };
    }));

    return results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
  }
}
