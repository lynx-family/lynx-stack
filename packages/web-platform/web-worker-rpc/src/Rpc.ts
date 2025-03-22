// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { RpcError } from './RpcEndpoint.js';
import type {
  RpcEndpoint,
  RpcEndpointAsync,
  RpcEndpointAsyncVoid,
  RpcEndpointAsyncWithTransfer,
  RpcEndpointSync,
  RpcEndpointSyncVoid,
  RpcEndpointBase,
  EndpointParameters,
  EndpointReturnType,
} from './RpcEndpoint.js';

/**
 * Interface for RPC message data for asynchronous calls
 */
interface RpcMessageData {
  /** ID for the return value, used for async calls with return values */
  retId?: string | undefined;
  /** Name of the endpoint being called */
  name: string;
  /** Arguments passed to the endpoint handler */
  data: unknown[];
  /** Indicates this is not a synchronous call */
  sync: false;
  /** Indicates if the message has transferable objects */
  hasTransfer?: boolean;
}

/**
 * Interface for RPC message data for synchronous calls
 */
interface RpcMessageDataSync {
  /** Name of the endpoint being called */
  name: string;
  /** Arguments passed to the endpoint handler */
  data: unknown[];
  /** Indicates this is a synchronous call */
  sync: true;
  /** Shared memory used for synchronization */
  lock: SharedArrayBuffer;
  /** Buffer for returning values from sync calls */
  buf: SharedArrayBuffer | undefined;
}

/**
 * Type for endpoint that returns values to async calls
 */
type RetEndpoint<Return> = RpcEndpointBase<
  [Return, boolean],
  void,
  false,
  false
>;

/**
 * Status codes for RPC calls
 */
enum RpcStatus {
  /** Call completed successfully */
  SUCCESS = 1,
  /** Call failed with an error */
  ERROR = 2,
  /** Call timed out */
  TIMEOUT = 3,
}

/**
 * Options for RPC configuration
 */
export interface RpcOptions {
  /** Enable verbose logging of RPC messages */
  debug?: boolean;
  /** Timeout for synchronous calls in milliseconds */
  syncTimeout?: number;
  /** Whether SharedArrayBuffer is enabled in the current environment */
  isSharedArrayBufferEnabled?: boolean;
  /** Alternative timeout for synchronous calls */
  timeoutForSyncCalls?: number;
}

/**
 * The instance for handling MessagePort Remote Process Call
 * Provides type-safe communication between threads using MessagePort
 */
export class Rpc {
  private incId = 0;
  private debug: boolean;
  private syncTimeout: number;

  #messageCache: Record<
    string,
    (RpcMessageData | RpcMessageDataSync)[] | undefined
  > = {};
  #textEncoder = new TextEncoder();
  #textDecoder = new TextDecoder();
  #handlerMap = new Map<
    string,
    | ((
      ...args: any[]
    ) =>
      | unknown
      | Promise<unknown>)
    | ((
      ...args: any[]
    ) =>
      | {
        data: unknown;
        transfer: Transferable[];
      }
      | Promise<{
        data: unknown;
        transfer: Transferable[];
      }>)
  >();

  /**
   * Create a new RPC instance
   * @param port MessagePort for communication between threads
   * @param name Instance name for debugging
   * @param options Configuration options
   */
  constructor(
    private port: MessagePort,
    private name: string,
    options: RpcOptions = {},
  ) {
    this.debug = options.debug ?? false;
    this.syncTimeout = options.syncTimeout ?? options.timeoutForSyncCalls
      ?? 30000; // Default 30s timeout
    port.onmessage = (ev) => this.#onMessage(ev.data);
  }

  /**
   * Get the next unique return ID for async calls
   */
  private get nextRetId() {
    return `ret_${this.name}_${this.incId++}`;
  }

  /**
   * Create an endpoint for returning values from async calls
   * @private Do not use directly
   */
  private static createRetEndpoint<Return>(retId: string): RetEndpoint<Return> {
    return {
      name: retId,
      hasReturn: false,
      isSync: false,
      _TypeParameters: [] as unknown as [Return, boolean],
      _TypeReturn: undefined as unknown as void,
    } as RetEndpoint<Return>;
  }

  /**
   * Handle incoming RPC messages
   * @param message The message data
   */
  #onMessage = async (
    message: RpcMessageData | RpcMessageDataSync,
  ) => {
    if (this.debug) {
      console.log(`[RPC:${this.name}] Received ${message.name}`, message);
    }

    const handler = this.#handlerMap.get(message.name);
    if (handler) {
      const lockViewer = message.sync
        ? new Int32Array(message.lock)
        : undefined;
      const replyTempEndpoint =
        (!message.sync && 'retId' in message && message.retId)
          ? Rpc.createRetEndpoint(message.retId)
          : undefined;
      try {
        const result = await handler(...message.data);
        let retData = undefined, transfer: Transferable[] = [];
        if (message.sync) {
          retData = result;
        } else if ('hasTransfer' in message && message.hasTransfer) {
          ({ data: retData, transfer } = (result || {}) as {
            data: unknown;
            transfer: Transferable[];
          });
        } else {
          retData = result;
        }

        if (message.sync) {
          if ('buf' in message && message.buf) {
            const retStr = JSON.stringify(retData);
            const lengthViewer = new Uint32Array(message.buf, 0, 1);
            const bufViewer = new Uint8Array(message.buf, 4);
            const retCache = new Uint8Array(message.buf.byteLength - 4);
            const { written: byteLength } = this.#textEncoder.encodeInto(
              retStr,
              retCache,
            );
            lengthViewer[0] = byteLength;
            bufViewer.set(retCache, 0);
          }
          Atomics.store(lockViewer!, 0, RpcStatus.SUCCESS);
          Atomics.notify(lockViewer!, 0);
        } else {
          if (replyTempEndpoint) {
            // Use invokeInternal to send response through the RetEndpoint
            this.invokeInternal(replyTempEndpoint, [retData, false], transfer);
          }
        }
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        console.error(
          `[RPC:${this.name}] Error handling ${message.name}:`,
          error,
        );

        if (message.sync) {
          Atomics.store(lockViewer!, 0, RpcStatus.ERROR);
          Atomics.notify(lockViewer!, 0);
          // Store error message in the additional space if available
          if (lockViewer!.length > 1) {
            lockViewer![1] = RpcStatus.ERROR;
          }
        } else if (replyTempEndpoint) {
          const errorData = {
            message: error.message,
            name: error.name,
            stack: error.stack,
          };
          // Use invokeInternal to send error response
          this.invokeInternal(replyTempEndpoint, [errorData, true], []);
        }
      }
    } else {
      const cache = this.#messageCache[message.name];
      if (cache) {
        cache.push(message);
      } else {
        this.#messageCache[message.name] = [message];
      }
    }
  };

  /**
   * Create a type-safe function for calling an RPC endpoint
   * @param endpoint The endpoint definition
   * @returns A function that calls the endpoint with proper typing
   */
  createCall<E extends RpcEndpointSync<unknown[], unknown>>(
    endpoint: E,
  ): (...args: EndpointParameters<E>) => EndpointReturnType<E>;
  createCall<E extends RpcEndpointSyncVoid<unknown[]>>(
    endpoint: E,
  ): (...args: EndpointParameters<E>) => void;
  createCall<E extends RpcEndpointAsync<unknown[], unknown>>(
    endpoint: E,
  ): (...args: EndpointParameters<E>) => Promise<EndpointReturnType<E>>;
  createCall<E extends RpcEndpointAsyncWithTransfer<unknown[], unknown>>(
    endpoint: E,
  ): (...args: EndpointParameters<E>) => Promise<EndpointReturnType<E>>;
  createCall<E extends RpcEndpointAsyncVoid<unknown[]>>(
    endpoint: E,
  ): (...args: EndpointParameters<E>) => void;
  createCall<E extends RpcEndpoint<unknown[], unknown>>(
    endpoint: E,
  ): (
    ...args: EndpointParameters<E>
  ) => Promise<EndpointReturnType<E>> | EndpointReturnType<E> | void {
    if (endpoint.isSync) {
      if (endpoint.hasReturn) {
        return (...args: EndpointParameters<E>) =>
          this.invoke(
            endpoint as RpcEndpointSync<unknown[], unknown>,
            args as any,
          ) as EndpointReturnType<E>;
      } else {
        return (...args: EndpointParameters<E>) =>
          this.invoke(endpoint as RpcEndpointSyncVoid<unknown[]>, args as any);
      }
    } else {
      if (endpoint.hasReturn) {
        if ((endpoint as any).hasReturnTransfer) {
          return (...args: EndpointParameters<E>) =>
            this.invoke(
              endpoint as RpcEndpointAsyncWithTransfer<unknown[], unknown>,
              args as any,
            ) as Promise<EndpointReturnType<E>>;
        } else {
          return (...args: EndpointParameters<E>) =>
            this.invoke(
              endpoint as RpcEndpointAsync<unknown[], unknown>,
              args as any,
            ) as Promise<EndpointReturnType<E>>;
        }
      } else {
        return (...args: EndpointParameters<E>) => {
          this.invoke(endpoint as RpcEndpointAsyncVoid<unknown[]>, args as any);
        };
      }
    }
  }

  /**
   * Register a handler function for an RPC endpoint
   * @param endpoint The endpoint definition
   * @param handler The function to handle calls to this endpoint
   */
  registerHandler<T extends RetEndpoint<any>>(
    endpoint: T,
    handler: (...args: EndpointParameters<T>) => void,
  ): void;
  registerHandler<T extends RpcEndpointAsync<unknown[], unknown>>(
    endpoint: T,
    handler: (
      ...args: EndpointParameters<T>
    ) => EndpointReturnType<T> | Promise<EndpointReturnType<T>>,
  ): void;
  registerHandler<T extends RpcEndpointAsyncWithTransfer<unknown[], unknown>>(
    endpoint: T,
    handler: (
      ...args: EndpointParameters<T>
    ) =>
      | {
        data: EndpointReturnType<T>;
        transfer: Transferable[];
      }
      | Promise<{
        data: EndpointReturnType<T>;
        transfer: Transferable[];
      }>,
  ): void;
  registerHandler<T extends RpcEndpointSync<unknown[], unknown>>(
    endpoint: T,
    handler: (...args: EndpointParameters<T>) => EndpointReturnType<T>,
  ): void;
  registerHandler<T extends RpcEndpointSyncVoid<unknown[]>>(
    endpoint: T,
    handler: (...args: EndpointParameters<T>) => void,
  ): void;
  registerHandler<T extends RpcEndpointAsyncVoid<unknown[]>>(
    endpoint: T,
    handler: (...args: EndpointParameters<T>) => void,
  ): void;
  registerHandler<
    T extends RpcEndpoint<unknown[], unknown> | RetEndpoint<unknown>,
  >(
    endpoint: T,
    handler: any,
  ): void {
    const { name } = endpoint;
    this.#handlerMap.set(name, handler);
    const cache = this.#messageCache[name];
    if (cache?.length) {
      const localCache = [...cache];
      this.#messageCache[name] = [];
      for (const message of localCache) {
        this.port.dispatchEvent(
          new MessageEvent('message', {
            data: message,
          }),
        );
      }
    }
  }

  /**
   * Internal method to invoke an endpoint without type checking
   * Used internally to avoid type errors with RetEndpoint
   * @private
   */
  private invokeInternal(
    endpoint: RpcEndpointBase<any, any, any, any> | RetEndpoint<unknown>,
    args: unknown[],
    transfer?: Transferable[],
  ): any {
    const { name, isSync } = endpoint;

    // For return endpoint (or any non-sync endpoint), make a non-sync call
    if (isSync === false) {
      const options = transfer?.length ? { transfer } : undefined;
      this.port.postMessage(
        {
          name,
          data: args,
          sync: false,
        },
        options,
      );
      return;
    }

    // For sync endpoints with return values
    if (isSync === true && (endpoint as any).hasReturn === true) {
      return this.invoke(endpoint as any, args);
    }

    // For sync endpoints without return values
    this.invoke(endpoint as any, args);
    return;
  }

  /**
   * Invoke an RPC endpoint
   * @param endpoint The endpoint to call
   * @param args Arguments to pass to the handler
   * @param transfer Transferable objects to transfer to the other thread (for async calls)
   * @returns The result of the call, if any
   * @throws RpcError if the call fails
   */
  invoke<E extends RpcEndpointSync<unknown[], unknown>>(
    endpoint: E,
    args: EndpointParameters<E>,
  ): EndpointReturnType<E>;
  invoke<E extends RpcEndpointSyncVoid<unknown[]>>(
    endpoint: E,
    args: EndpointParameters<E>,
  ): void;
  invoke<E extends RpcEndpointAsync<unknown[], unknown>>(
    endpoint: E,
    args: EndpointParameters<E>,
  ): Promise<EndpointReturnType<E>>;
  invoke<E extends RpcEndpointAsyncVoid<unknown[]>>(
    endpoint: E,
    args: EndpointParameters<E>,
  ): void;
  invoke<E extends RpcEndpointAsyncWithTransfer<unknown[], unknown>>(
    endpoint: E,
    args: EndpointParameters<E>,
    transfer?: Transferable[],
  ): Promise<EndpointReturnType<E>>;
  invoke<E extends RpcEndpoint<unknown[], unknown> | RetEndpoint<unknown>>(
    endpoint: E,
    args: unknown[],
    transfer?: Transferable[],
  ): any {
    const { name, isSync } = endpoint;
    const hasReturn = 'hasReturn' in endpoint ? endpoint.hasReturn : false;
    const bufferSize = 'bufferSize' in endpoint
      ? endpoint.bufferSize
      : undefined;

    if (this.debug) {
      console.log(`[RPC:${this.name}] Invoking ${name}`, {
        args,
        isSync,
        hasReturn,
      });
    }

    if (isSync) {
      if (hasReturn) {
        if (
          typeof globalThis !== 'undefined'
          && 'document' in globalThis
          && !('crossOriginIsolated' in globalThis
            && globalThis.crossOriginIsolated)
        ) {
          throw new RpcError(
            'Synchronous calls with return values require SharedArrayBuffer which requires Cross-Origin Isolation',
            name,
            isSync,
            args as unknown[],
          );
        }

        // For sync calls with return values
        const lock = new SharedArrayBuffer(8); // 2 int32 values
        const lockViewer = new Int32Array(lock);
        lockViewer[0] = 0; // Status: 0 = waiting, 1 = success, 2 = error

        let buf: SharedArrayBuffer | undefined;
        if (bufferSize) {
          buf = new SharedArrayBuffer(bufferSize + 4);
        }

        this.port.postMessage({
          name,
          data: args,
          sync: true,
          lock,
          buf,
        });

        // Wait for the call to complete with timeout
        const status = Atomics.wait(
          lockViewer,
          0,
          0,
          this.syncTimeout,
        );

        if (status === 'timed-out') {
          throw new RpcError(
            `Synchronous call timed out after ${this.syncTimeout}ms`,
            name,
            isSync,
            args as unknown[],
          );
        }

        const resultStatus = Atomics.load(lockViewer, 0);
        if (resultStatus === RpcStatus.ERROR) {
          throw new RpcError(
            'Call failed on remote side',
            name,
            isSync,
            args as unknown[],
          );
        }

        if (buf) {
          const lengthViewer = new Uint32Array(buf, 0, 1);
          const length = lengthViewer[0];
          const dataViewer = new Uint8Array(buf, 4, length);
          const jsonStr = this.#textDecoder.decode(dataViewer);
          try {
            return JSON.parse(jsonStr);
          } catch (e) {
            throw new RpcError(
              `Failed to parse return value: ${e}`,
              name,
              isSync,
              args as unknown[],
            );
          }
        }

        return undefined;
      } else {
        // For sync calls without return values
        this.port.postMessage({
          name,
          data: args,
          sync: true,
          lock: new SharedArrayBuffer(4),
        });
        return;
      }
    } else {
      // Async calls
      if (hasReturn) {
        const retId = this.nextRetId;
        const hasReturnTransfer = 'hasReturnTransfer' in endpoint
          ? endpoint.hasReturnTransfer
          : false;
        const hasTransfer = hasReturnTransfer && Array.isArray(transfer)
          && transfer.length > 0;

        this.port.postMessage(
          {
            name,
            data: args,
            sync: false,
            retId,
            hasTransfer,
          },
          transfer?.length ? { transfer } : undefined,
        );

        return new Promise((resolve, reject) => {
          const retHandler = (ret: unknown, hasError: boolean) => {
            if (hasError) {
              const error = new RpcError(
                (ret as any)?.message || 'Unknown error',
                name,
                isSync,
                args as unknown[],
              );
              if ((ret as any)?.stack) {
                error.stack = (ret as any).stack;
              }
              reject(error);
            } else {
              resolve(ret);
            }
          };

          // Use the full handler registration to avoid type issues
          this.registerHandler(
            Rpc.createRetEndpoint(retId),
            retHandler,
          );
        });
      } else {
        // For async calls without return values
        this.port.postMessage(
          {
            name,
            data: args,
            sync: false,
          },
          transfer?.length ? { transfer } : undefined,
        );
        return;
      }
    }
  }

  /**
   * Close the RPC instance and clean up resources
   */
  dispose(): void {
    this.#handlerMap.clear();
    this.#messageCache = {};
    try {
      this.port.close();
    } catch (e) {
      // Ignore errors during close
    }
  }
}
