// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  DebugRouterConnector as BaseDebugRouterConnector,
  MultiOpenStatus,
  SocketEvent,
} from '@lynx-js/debug-router-connector';
import createDebug from 'debug';
import EventEmitter from 'node:events';

const debug = createDebug('lynx-devtool-mcp:cdp');

type ConsoleAPI = {
  args: { type: 'string'; value: string }[];
  consoleId: number;
  executionContextId: number;
  stackTrace: {
    callFrames: {
      columnNumber: number;
      functionName: string;
      lineNumber: number;
      scriptId: string;
      url: string;
    }[];
  };
  timestamp: number;
  type: 'log' | 'info' | 'warning' | 'error' | 'debug';
  url: string;
  viewId: number;
};

type Session = {
  type: string;
  session_id: number;
  url: string;
};
type SessionListResponse = {
  type: 'SessionList';
  data: Session[];
  sender: number;
};
type CDPResponse = {
  type: 'CDP';
  data: {
    client_id: number;
    session_id: number;
    message: string;
  };
  sender: number;
};
type GetGlobalSwitchResponse = {
  type: 'GetGlobalSwitch';
  data: string | boolean | { global_value: string | boolean };
  sender: number;
};
type SetGlobalSwitchResponse = {
  type: 'SetGlobalSwitch';
  data: { global_value: boolean; global_key: GlobalKey };
  sender: number;
};
type CustomizeResponse = {
  event: 'Customized';
  data:
    | CDPResponse
    | SessionListResponse
    | GetGlobalSwitchResponse
    | SetGlobalSwitchResponse;
};

type ParsedSource = {
  endColumn: number;
  endLine: number;
  executionContextId: number;
  hasSourceURL: boolean;
  hash: string;
  length: number;
  scriptId: string;
  scriptLanguage: 'JavaScript';
  sourceMapURL: string;
  startColumn: number;
  startLine: number;
  url: string;
  viewId: number;
};

type EventMap = {
  SessionList: [Session[]];
  GetGlobalSwitch: [string | boolean | { global_value: string | boolean }];
  SetGlobalSwitch: [{ global_value: boolean; global_key: GlobalKey }];
  'CDP-event-Runtime.consoleAPICalled': [
    error: string | undefined,
    ConsoleAPI,
    clientId: number,
    sessionId: number,
  ];
  'CDP-event-Debugger.scriptParsed': [
    error: string | undefined,
    ParsedSource,
    clientId: number,
    sessionId: number,
  ];
  [CDPId: `CDP-${number}` | `CDP-event-${string}`]: [
    error: string | undefined,
    unknown,
    clientId: number,
    sessionId: number,
  ];
};

type GlobalKey = 'enable_devtool';

export class DebugRouterConnector extends BaseDebugRouterConnector {
  #messageEmitter: EventEmitter<EventMap> = new EventEmitter();
  #consoleCollectors: Map<
    /** clientId */ number,
    Map</** sessionId */ number, ConsoleAPI[]>
  > = new Map();
  #scriptSourceCollectors: Map<
    /** clientId */ number,
    Map</** sessionId */ number, ParsedSource[]>
  > = new Map();

  constructor() {
    super({
      manualConnect: true,
      enableWebSocket: true,
      enableDesktop: true,
    });

    this.#listenClientMessages();
    this.#collectConsoleMessages();
    this.#collectScriptSources();
  }

  async getGlobalSwitch(clientId: number, key: GlobalKey): Promise<boolean> {
    const { promise, resolve } = Promise.withResolvers<boolean>();

    this.#messageEmitter.once('GetGlobalSwitch', (result) => {
      if (typeof result === 'object') {
        resolve(
          result?.global_value === 'true' || result?.global_value === true,
        );
      } else {
        resolve(result === 'true' || result === true);
      }
    });

    this.sendMessageToApp(
      clientId,
      JSON.stringify({
        event: 'Customized',
        data: {
          type: 'GetGlobalSwitch',
          data: {
            client_id: clientId,
            message: JSON.stringify({
              global_key: key,
              id: 10000,
            }),
            session_id: -1,
          },
          sender: clientId,
        },
        from: clientId,
      }),
    );

    return promise;
  }

  async setGlobalSwitch(
    clientId: number,
    key: GlobalKey,
    value: boolean,
  ): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>();

    this.#messageEmitter.once('SetGlobalSwitch', () => {
      resolve();
    });

    this.sendMessageToApp(
      clientId,
      JSON.stringify({
        event: 'Customized',
        data: {
          type: 'SetGlobalSwitch',
          data: {
            client_id: clientId,
            message: JSON.stringify({
              global_key: key,
              global_value: value,
              id: 10000,
            }),
            session_id: -1,
          },
          sender: clientId,
        },
        from: clientId,
      }),
    );

    return promise;
  }

  async sendSessionListMessage(clientId: number): Promise<Session[]> {
    const { promise, resolve } = Promise.withResolvers<Session[]>();

    this.#messageEmitter.once('SessionList', (sessions) => {
      resolve(sessions);
    });

    this.sendMessageToApp(
      clientId,
      JSON.stringify({
        event: 'Customized',
        data: {
          type: 'ListSession',
          data: [],
          sender: clientId,
        },
        from: clientId,
      }),
    );

    return promise;
  }

  #currentCDPId = 0;
  async sendCDPMessage<Response>(
    clientId: number,
    sessionId: number,
    method: string,
    params?: Record<string, unknown>,
  ): Promise<Response> {
    const { promise, resolve, reject } = Promise.withResolvers<Response>();

    const id = this.#currentCDPId++;
    this.#messageEmitter.once(`CDP-${id}`, (error, data) => {
      if (error !== undefined) {
        reject(new Error(error));
        return;
      }

      resolve(data as Response);
    });

    this.sendMessageToApp(
      clientId,
      JSON.stringify({
        event: 'Customized',
        data: {
          type: 'CDP',
          data: {
            client_id: clientId,
            session_id: sessionId,
            message: {
              method,
              id,
              params,
            },
          },
          sender: clientId,
        },
        from: clientId,
      }),
    );

    return promise;
  }

  async waitForCDPEvent<Response>(event: string): Promise<Response> {
    const { promise, resolve, reject } = Promise.withResolvers<Response>();
    this.#messageEmitter.once(`CDP-event-${event}`, (error, data) => {
      if (error !== undefined) {
        reject(new Error(error));
        return;
      }

      resolve(data as Response);
    });
    return promise;
  }

  #listenClientMessages() {
    this.on('usb-client-message', ({ message, id }) => {
      const { data, event } = JSON.parse(message) as CustomizeResponse;

      if (event !== SocketEvent.Customized) {
        // We do not care about non-customized messages
        //   E.g.: register messages
        return;
      }

      data.sender = id;
      switch (data.type) {
        case 'CDP':
          data.data.client_id = id;
          this.#handleCDPResponse(data);
          break;
        case 'SessionList':
          this.#handleSessionListResponse(data);
          break;
        case 'GetGlobalSwitch':
          this.#handleGetGlobalSwitchResponse(data);
          break;
        case 'SetGlobalSwitch':
          this.#handleSetGlobalSwitchResponse(data);
          break;
        default:
          debug(`Unknown message type: %O, event: %s`, data, event);
      }
    });
  }

  getConsole(clientId: number, sessionId: number): ConsoleAPI[] {
    const sessionConsoleCollectors = this.#consoleCollectors.get(clientId);
    if (!sessionConsoleCollectors) {
      throw new Error('No console collectors for clientId:' + clientId);
    }
    const consoleMessages = sessionConsoleCollectors.get(sessionId);
    if (!consoleMessages) {
      throw new Error('No console messages for sessionId:' + sessionId);
    }
    return consoleMessages || [];
  }

  #collectConsoleMessages() {
    this.onCDPEvent(
      'Runtime.consoleAPICalled',
      (_, data, clientId, sessionId) => {
        if (!this.#consoleCollectors.has(clientId)) {
          this.#consoleCollectors.set(clientId, new Map());
        }
        const sessionConsoleCollectors = this.#consoleCollectors.get(clientId)!;
        if (!sessionConsoleCollectors.has(sessionId)) {
          sessionConsoleCollectors.set(sessionId, []);
        }
        const consoleMessages = sessionConsoleCollectors.get(sessionId)!;
        consoleMessages.push(data);
      },
    );
  }

  getSource(
    clientId: number,
    sessionId: number,
    scriptId?: string,
  ): ParsedSource[] {
    const sessionScriptSourceCollectors = this.#scriptSourceCollectors.get(
      clientId,
    );
    if (!sessionScriptSourceCollectors) {
      throw new Error('No script source collectors for clientId:' + clientId);
    }
    const scriptSources = sessionScriptSourceCollectors.get(sessionId);
    if (!scriptSources) {
      throw new Error('No script sources for sessionId:' + sessionId);
    }

    if (scriptId) {
      return scriptSources.filter(source => source.scriptId === scriptId);
    }

    return scriptSources;
  }

  #collectScriptSources() {
    this.onCDPEvent('Debugger.scriptParsed', (_, data, clientId, sessionId) => {
      if (!this.#scriptSourceCollectors.has(clientId)) {
        this.#scriptSourceCollectors.set(clientId, new Map());
      }
      const sessionScriptSourceCollectors = this.#scriptSourceCollectors.get(
        clientId,
      )!;
      if (!sessionScriptSourceCollectors.has(sessionId)) {
        sessionScriptSourceCollectors.set(sessionId, []);
      }
      const scriptSources = sessionScriptSourceCollectors.get(sessionId)!;
      scriptSources.push(data);
    });
  }

  #handleGetGlobalSwitchResponse({ data }: GetGlobalSwitchResponse) {
    this.#messageEmitter.emit('GetGlobalSwitch', data);
  }

  #handleSetGlobalSwitchResponse({ data }: SetGlobalSwitchResponse) {
    this.#messageEmitter.emit('SetGlobalSwitch', data);
  }

  #handleCDPResponse({ data }: CDPResponse) {
    interface CDPDetailedMessage {
      id: number;
      result: unknown;
      error?: {
        code: number;
        message: string;
      };
    }
    interface CDPEvent {
      method: string;
      params: Record<string, unknown>;
      error?: {
        code: number;
        message: string;
      };
    }
    const response = JSON.parse(data.message) as CDPDetailedMessage | CDPEvent;
    if ('error' in response) {
      debug(`Error %s`, response.error.message);
    } else {
      debug(
        `Response ${data.client_id} ${data.session_id} %O`,
        JSON.parse(data.message),
      );
    }
    if ('id' in response) {
      // Response
      this.#messageEmitter.emit(
        `CDP-${response.id}`,
        response.error?.message,
        response.result,
        data.client_id,
        data.session_id,
      );
    } else {
      // Event
      this.#messageEmitter.emit(
        `CDP-event-${response.method}`,
        response.error?.message,
        response.params,
        data.client_id,
        data.session_id,
      );
    }
  }

  #handleSessionListResponse({ data, sender }: SessionListResponse) {
    this.#messageEmitter.emit('SessionList', data);
    for (const { session_id } of data) {
      this.sendCDPMessage(sender, session_id, 'Runtime.enable', {});
    }
  }

  onCDPEvent<EventName extends string>(
    event: EventName,
    listener: (
      ...args: `CDP-event-${EventName}` extends `CDP-event-${infer E}`
        ? EventMap[`CDP-event-${E}`]
        : unknown[]
    ) => void,
  ) {
    this.#messageEmitter.on(`CDP-event-${event}`, listener as never);
  }
}

let connector: DebugRouterConnector | null = null;

export async function ensureLynxConnected(): Promise<DebugRouterConnector> {
  if (connector === null) {
    connector = new DebugRouterConnector();
    connector.setMultiOpenCallback({
      statusChanged(status) {
        if (status === MultiOpenStatus.unattached) {
          connector = null;
        }
      },
    });
    await connector.startWSServer();

    connector.on('device-connected', (device) => {
      device.startWatchClient();
    });

    connector.on('client-connected', async client => {
      const devtoolEnabled = await connector?.getGlobalSwitch(
        client.clientId(),
        'enable_devtool',
      );

      if (!devtoolEnabled) {
        await connector?.setGlobalSwitch(
          client.clientId(),
          'enable_devtool',
          true,
        );
      }
      await connector?.sendSessionListMessage(client.clientId());
    });
  }

  if (connector.devices.size === 0) {
    const devices = await connector.connectDevices(1000);
    if (devices.length === 0) {
      throw new Error('Failed to connect to Lynx: no device found.');
    }
  }

  return connector;
}

export async function reconnect(): Promise<void> {
  connector = null;
  await ensureLynxConnected();
}
