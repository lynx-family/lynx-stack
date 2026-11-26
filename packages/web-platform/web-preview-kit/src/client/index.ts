// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * A typed client of the preview protocol for host applications. It has no
 * runtime dependencies.
 *
 * @example
 * ```ts
 * const preview = await connectPreview(iframe, {
 *   origin: 'https://preview.example.com',
 * });
 * preview.on('build.done', (summary) => console.log(summary.errors));
 * await preview.open(files, { entries: { main: 'src/index.tsx' } });
 * ```
 *
 * @packageDocumentation
 */

import type {
  ErrorCode,
  EventMessage,
  EventName,
  Events,
  FileChange,
  FileContent,
  FileMap,
  HelloInfo,
  MethodName,
  Methods,
  PreviewData,
  ProjectConfig,
  ReadyMessage,
  RequestMessage,
  ResponseMessage,
} from '../protocol.js';
import { PROTOCOL_CHANNEL, PROTOCOL_VERSION } from '../protocol.js';

export type * from '../protocol.js';
export { PROTOCOL_CHANNEL, PROTOCOL_VERSION } from '../protocol.js';

/** A request that the kit answered with an error. */
export class PreviewRequestError extends Error {
  /** The error code of the protocol. */
  readonly code: ErrorCode;
  /** The method of the failed request. */
  readonly method: MethodName;

  constructor(method: MethodName, code: ErrorCode, message: string) {
    super(`${method} failed with ${code}: ${message}`);
    this.name = 'PreviewRequestError';
    this.method = method;
    this.code = code;
  }
}

/** The client was disposed, or the handshake timed out or was aborted. */
export class PreviewClientError extends Error {
  readonly reason: 'disposed' | 'timeout';

  constructor(reason: 'disposed' | 'timeout', message: string) {
    super(message);
    this.name = 'PreviewClientError';
    this.reason = reason;
  }
}

/** The part of `MessagePort` the client uses. */
export interface PortLike {
  postMessage(message: unknown): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
  start?(): void;
  close(): void;
}

/** Parameters of a method, optional when the method takes none. */
type ParamsArgs<M extends MethodName> = Methods[M]['params'] extends undefined
  ? [params?: undefined]
  : [params: Methods[M]['params']];

/** A connected preview. */
export interface PreviewClient {
  /** The `hello` event of the session. */
  readonly hello: HelloInfo;

  /** Sends a request and resolves to its result. */
  request<M extends MethodName>(
    method: M,
    ...params: ParamsArgs<M>
  ): Promise<Methods[M]['result']>;

  /** Listens to an event. Returns a function that removes the listener. */
  on<E extends EventName>(
    event: E,
    listener: (data: Events[E]) => void,
  ): () => void;

  /** `project.open` */
  open(
    files: FileMap,
    config: ProjectConfig,
    options?: { card?: string; data?: PreviewData },
  ): Promise<{ revision: number }>;
  /** `project.configure` */
  configure(config: ProjectConfig): Promise<{ revision: number }>;
  /** `project.close` */
  close(): Promise<void>;
  /** `fs.apply` */
  applyChanges(changes: FileChange[]): Promise<{ revision: number }>;
  /** `fs.apply` with one `write`. */
  writeFile(path: string, content: FileContent): Promise<{ revision: number }>;
  /** `fs.read` */
  readFile(path: string, encoding?: 'utf8' | 'binary'): Promise<FileContent>;
  /** `fs.list` */
  listFiles(): Promise<string[]>;
  /** `build.getAsset` */
  getAsset(name: string): Promise<Uint8Array>;
  /** `preview.select` */
  selectCard(card: string): Promise<{ card: string }>;
  /** `preview.reload` */
  reload(): Promise<void>;
  /** `preview.setData` */
  setData(data: PreviewData): Promise<void>;

  /**
   * Closes the port. Pending requests reject with a
   * {@link PreviewClientError}; the kit keeps its state for a later
   * connection.
   */
  dispose(): void;
}

interface Pending {
  method: MethodName;
  resolve(result: unknown): void;
  reject(error: Error): void;
}

/**
 * Builds a client on a port whose handshake is done. `connectPreview` is the
 * usual way to get one.
 */
export function createPreviewClient(
  port: PortLike,
  hello: HelloInfo,
): PreviewClient {
  let nextId = 1;
  let disposed = false;
  const pending = new Map<number, Pending>();
  const listeners = new Map<EventName, Set<(data: unknown) => void>>();

  port.addEventListener('message', (event) => {
    const message = event.data as Partial<ResponseMessage & EventMessage>;
    if (typeof message !== 'object' || message === null) {
      return;
    }
    if (typeof message.event === 'string') {
      for (const listener of listeners.get(message.event) ?? []) {
        try {
          listener(message.data);
        } catch (error) {
          console.error(error);
        }
      }
      return;
    }
    if (typeof message.id !== 'number') {
      return;
    }
    const request = pending.get(message.id);
    if (!request) {
      return;
    }
    pending.delete(message.id);
    if ('error' in message && message.error) {
      request.reject(
        new PreviewRequestError(
          request.method,
          message.error.code,
          message.error.message,
        ),
      );
    } else {
      request.resolve((message as { result?: unknown }).result);
    }
  });
  port.start?.();

  function send<M extends MethodName>(
    method: M,
    params: Methods[M]['params'],
  ): Promise<Methods[M]['result']> {
    if (disposed) {
      return Promise.reject(
        new PreviewClientError('disposed', 'The preview client is disposed.'),
      );
    }
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const entry: Pending = {
        method,
        resolve: resolve as (result: unknown) => void,
        reject,
      };
      pending.set(id, entry);
      const message: RequestMessage<M> = { id, method, params };
      port.postMessage(message);
    });
  }

  const client: PreviewClient = {
    hello,
    request: (method, ...params) => send(method, params[0]!),
    on(event, listener) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      const wrapped = listener as (data: unknown) => void;
      set.add(wrapped);
      return () => {
        set.delete(wrapped);
      };
    },
    open: (files, config, options = {}) =>
      send('project.open', { files, config, ...options }),
    configure: config => send('project.configure', { config }),
    close: () => send('project.close', undefined),
    applyChanges: changes => send('fs.apply', { changes }),
    writeFile: (path, content) =>
      send('fs.apply', { changes: [{ type: 'write', path, content }] }),
    readFile: async (path, encoding) =>
      (await send('fs.read', {
        path,
        ...(encoding === undefined ? {} : { encoding }),
      })).content,
    listFiles: async () => (await send('fs.list', undefined)).files,
    getAsset: async name => (await send('build.getAsset', { name })).content,
    selectCard: card => send('preview.select', { card }),
    reload: () => send('preview.reload', undefined),
    setData: data => send('preview.setData', data),
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      port.close();
      const error = new PreviewClientError(
        'disposed',
        'The preview client is disposed.',
      );
      for (const request of pending.values()) {
        request.reject(error);
      }
      pending.clear();
      listeners.clear();
    },
  };
  return client;
}

export interface ConnectOptions {
  /** The origin of the kit, for example `https://preview.example.com`. */
  origin: string;
  /**
   * How long to wait for the kit to answer the handshake.
   *
   * @defaultValue `30000`
   */
  timeoutMs?: number;
  /** Aborts the handshake. */
  signal?: AbortSignal;
}

/** How often the client probes a kit that has not announced itself. */
const PROBE_INTERVAL_MS = 200;

/**
 * Connects to the kit in `iframe`: waits for its `ready` message, probing in
 * case it was missed, opens a `MessageChannel` and waits for `hello`.
 */
export function connectPreview(
  iframe: HTMLIFrameElement,
  options: ConnectOptions,
): Promise<PreviewClient> {
  const { origin, timeoutMs = 30_000, signal } = options;
  return new Promise<PreviewClient>((resolve, reject) => {
    let done = false;
    let channel: MessageChannel | undefined;
    let probeTimer: ReturnType<typeof setInterval> | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      done = true;
      clearInterval(probeTimer);
      clearTimeout(timeoutTimer);
      window.removeEventListener('message', onWindowMessage);
      signal?.removeEventListener('abort', onAbort);
    };
    const fail = (error: Error) => {
      if (done) {
        return;
      }
      cleanup();
      channel?.port1.close();
      reject(error);
    };
    const onAbort = () =>
      fail(
        signal?.reason instanceof Error
          ? signal.reason
          : new PreviewClientError('disposed', 'The handshake was aborted.'),
      );
    const probe = () => {
      iframe.contentWindow?.postMessage(
        { channel: PROTOCOL_CHANNEL, type: 'probe' },
        origin,
      );
    };
    const onWindowMessage = (event: MessageEvent<unknown>) => {
      const message = event.data as Partial<ReadyMessage> | null;
      if (
        done || channel
        || event.source !== iframe.contentWindow || event.origin !== origin
        || typeof message !== 'object' || message === null
        || message.channel !== PROTOCOL_CHANNEL || message.type !== 'ready'
      ) {
        return;
      }
      if (!message.versions?.includes(PROTOCOL_VERSION)) {
        fail(
          new Error(
            `The kit speaks protocol versions ${
              JSON.stringify(message.versions)
            }, not ${PROTOCOL_VERSION}.`,
          ),
        );
        return;
      }
      clearInterval(probeTimer);
      channel = new MessageChannel();
      const port = channel.port1;
      port.onmessage = (portEvent: MessageEvent<unknown>) => {
        const first = portEvent.data as Partial<EventMessage> | null;
        if (first?.event !== 'hello' || done) {
          return;
        }
        port.onmessage = null;
        cleanup();
        resolve(createPreviewClient(port, first.data as HelloInfo));
      };
      iframe.contentWindow!.postMessage(
        {
          channel: PROTOCOL_CHANNEL,
          type: 'connect',
          version: PROTOCOL_VERSION,
        },
        origin,
        [channel.port2],
      );
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort);
    window.addEventListener('message', onWindowMessage);
    probeTimer = setInterval(probe, PROBE_INTERVAL_MS);
    timeoutTimer = setTimeout(
      () =>
        fail(
          new PreviewClientError(
            'timeout',
            `The kit at ${origin} did not complete the handshake within ${timeoutMs} ms.`,
          ),
        ),
      timeoutMs,
    );
    probe();
  });
}
