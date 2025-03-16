// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  RpcEndpoint,
  RpcEndpointAsync,
  RpcEndpointAsyncVoid,
  RpcEndpointAsyncWithTransfer,
  RpcEndpointBase,
  RpcEndpointSync,
  RpcEndpointSyncVoid,
} from './RpcEndpoint.js';
interface RpcMessageData {
  retId?: string | undefined;
  name: string;
  data: unknown[];
  sync: false;
  hasTransfer?: boolean;
}
interface RpcMessageDataSync {
  name: string;
  data: unknown[];
  sync: true;
  lock: SharedArrayBuffer;
  buf: SharedArrayBuffer | undefined;
}

type RetEndpoint<Return> = RpcEndpointBase<
  [Return, boolean],
  void,
  false,
  false
>;

/**
 * The instance for handling MessagePort Remote Process Call
 */
export class Rpc {
  private incId = 0;

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
   * @param port one size of a message channel
   * @param name instance name
   */
  constructor(private port: MessagePort, private name: string) {
    port.onmessage = (ev) => this.#onMessage(ev.data);
  }
  get nextRetId() {
    return `ret_${this.name}_${this.incId++}`;
  }

  /**
   * @private do not use this
   * @param retId
   * @returns
   */
  private static createRetEndpoint<Return>(retId: string): RetEndpoint<Return> {
    return {
      name: retId,
      hasReturn: false,
      isSync: false,
    } as unknown as RetEndpoint<Return>;
  }

  #onMessage: (
    message: RpcMessageData | RpcMessageDataSync,
  ) => void = async (
    message,
  ) => {
    console.warn(`[rpc] on ${this.name} received ${message.name}`, message);
    const handler = this.#handlerMap.get(message.name);
    if (handler) {
      const lockViewer = message.sync
        ? new Int32Array(message.lock)
        : undefined;
      const replyTempEndpoint = (!message.sync && message.retId)
        ? Rpc.createRetEndpoint(message.retId)
        : undefined;
      try {
        const result = await handler(...message.data);
        let retData = undefined, transfer: Transferable[] = [];
        if (message.sync) {
          retData = result;
        } else if (message.hasTransfer) {
          ({ data: retData, transfer } = (result || {}) as {
            data: unknown;
            transfer: Transferable[];
          });
        } else {
          retData = result;
        }

        if (message.sync) {
          if (message.buf) {
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
          Atomics.store(lockViewer!, 0, 1);
          Atomics.notify(lockViewer!, 0);
        } else {
          if (message.retId) {
            this.invoke<RetEndpoint<unknown>>(replyTempEndpoint!, [
              retData,
              false,
            ], transfer || []);
          }
        }
      } catch (e) {
        console.error(e);
        if (message.sync) {
          Atomics.store(lockViewer!, 0, 2);
          Atomics.notify(lockViewer!, 0);
          lockViewer![1] = 2;
        } else {
          this.invoke(replyTempEndpoint!, [undefined, true]);
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
   * initialize a endpoint into a function
   * @param endpoint
   */
  createCall<E extends RpcEndpointSync<unknown[], unknown>>(
    endpoint: E,
  ): (...args: E['_TypeParameters']) => E['_TypeReturn'];
  createCall<E extends RpcEndpointSyncVoid<unknown[]>>(
    endpoint: E,
  ): (...args: E['_TypeParameters']) => void;
  createCall<E extends RpcEndpointAsync<unknown[], unknown>>(
    endpoint: E,
  ): (...args: E['_TypeParameters']) => Promise<E['_TypeReturn']>;
  createCall<E extends RpcEndpointAsyncVoid<unknown[]>>(
    endpoint: E,
  ): (...args: E['_TypeParameters']) => void;
  createCall<E extends RpcEndpoint<unknown[], unknown>>(
    endpoint: E,
  ): (
    ...args: E['_TypeParameters']
  ) => Promise<E['_TypeReturn']> | E['_TypeReturn'] | void {
    return (...args) => {
      return this.invoke(endpoint, args);
    };
  }

  /**
   * register a handler for an endpoint
   * @param endpoint
   * @param handler
   */
  registerHandler<T extends RetEndpoint<any>>(
    endpoint: T,
    handler: (...args: T['_TypeParameters']) => void,
  ): void;
  registerHandler<T extends RpcEndpoint<any[], any>>(
    endpoint: T,
    handler:
      | ((...args: T['_TypeParameters']) => T['_TypeReturn'])
      | ((...args: T['_TypeParameters']) => Promise<T['_TypeReturn']>),
  ): void;
  registerHandler<T extends RpcEndpointAsyncWithTransfer<any[], any>>(
    endpoint: T,
    handler:
      | ((
        ...args: T['_TypeParameters']
      ) => { data: T['_TypeReturn']; transfer: Transferable[] })
      | ((
        ...args: T['_TypeParameters']
      ) => Promise<{ data: T['_TypeReturn']; transfer: Transferable[] }>),
  ): void;
  registerHandler<T extends RpcEndpoint<any[], any>>(
    endpoint: T,
    handler: (
      ...args: T['_TypeParameters']
    ) => void | T['_TypeReturn'] | {
      data: T['_TypeReturn'];
      transfer: Transferable[];
    } | Promise<{ data: T['_TypeReturn']; transfer: Transferable[] }>,
  ): void {
    this.#handlerMap.set(endpoint.name, handler);
    const currentCache = this.#messageCache[endpoint.name];
    if (currentCache?.length) {
      this.#messageCache[endpoint.name] = undefined;
      for (const message of currentCache) {
        this.#onMessage(message);
      }
    }
  }

  /**
   * register a property of an object as a handler
   * @param endpoint
   * @param handler
   */

  registerHandlerRef<
    T extends RetEndpoint<any>,
    const PropertyName extends string,
    Handler extends (...args: T['_TypeParameters']) => T['_TypeReturn'],
  >(
    endpoint: T,
    target: {
      [key in PropertyName]: Handler | undefined;
    },
    propertyName: PropertyName,
  ): void;
  registerHandlerRef<
    T extends RpcEndpoint<any[], any>,
    const PropertyName extends string,
    Handler extends (...args: T['_TypeParameters']) => T['_TypeReturn'],
  >(
    endpoint: T,
    target: {
      [key in PropertyName]: Handler | undefined;
    },
    propertyName: PropertyName,
  ): void;
  registerHandlerRef<
    T extends RpcEndpoint<any[], any>,
    const PropertyName extends string,
    Handler extends (...args: T['_TypeParameters']) => T['_TypeReturn'],
  >(
    endpoint: T,
    target: {
      [key in PropertyName]: Handler | undefined;
    },
    propertyName: PropertyName,
  ): void {
    this.registerHandler(endpoint, (...args: T['_TypeParameters']) => {
      return target[propertyName]?.call(target, ...args);
    });
  }

  /**
   * register a handler "lazy" for an endpoint
   * It will add a setter for the target property name
   * once the value is set, we will add it as a handler.
   * @param endpoint
   * @param handler
   */
  /**
   * register a handler for an endpoint
   * @param endpoint
   * @param handler
   */
  registerHandlerLazy<
    T extends RetEndpoint<any>,
    const PropertyName extends string,
    Handler extends (...args: T['_TypeParameters']) => T['_TypeReturn'],
  >(
    endpoint: T,
    target: {
      [key in PropertyName]: Handler | undefined;
    },
    propertyName: PropertyName,
  ): void;
  registerHandlerLazy<
    T extends RpcEndpoint<any[], any>,
    const PropertyName extends string,
    Handler extends (...args: T['_TypeParameters']) => T['_TypeReturn'],
  >(
    endpoint: T,
    target: {
      [key in PropertyName]: Handler | undefined;
    },
    propertyName: PropertyName,
  ): void;
  registerHandlerLazy<
    T extends RpcEndpoint<any[], any>,
    const PropertyName extends string,
    Handler extends (...args: T['_TypeParameters']) => T['_TypeReturn'],
  >(
    endpoint: T,
    target: {
      [key in PropertyName]: Handler | undefined;
    },
    propertyName: PropertyName,
  ): void {
    if (target[propertyName]) {
      this.registerHandlerRef(endpoint, target, propertyName);
    } else {
      let property: Handler | undefined = undefined;
      const rpc = this;
      Object.defineProperty(
        target,
        propertyName,
        {
          get() {
            return property;
          },
          set(v) {
            property = v;
            if (v) {
              rpc.registerHandlerRef(endpoint, target, propertyName);
            }
          },
        },
      );
    }
  }

  /**
   * Remove the handler for the name
   * @param name
   */
  removeHandler(rpc: RpcEndpoint<unknown[], unknown>): void {
    this.#handlerMap.delete(rpc.name);
  }

  /**
   * the low level api for sending a rpc message
   * recommend to use the `createCall`
   * @param endpoint
   * @param parameters
   */
  invoke<T extends RetEndpoint<unknown>>(
    endpoint: T,
    parameters: T['_TypeParameters'],
  ): void;
  invoke<
    E extends (
      | RpcEndpointSyncVoid<unknown[]>
      | RpcEndpointSync<unknown[], unknown>
    ),
  >(
    endpoint: E,
    parameters: E['_TypeParameters'],
    transfer?: Transferable[],
  ): E['_TypeReturn'];
  invoke<E extends RpcEndpointAsyncVoid<unknown[]>>(
    endpoint: E,
    parameters: E['_TypeParameters'],
    transfer?: Transferable[],
  ): void;
  invoke<E extends RpcEndpointAsync<unknown[], unknown>>(
    endpoint: E,
    parameters: E['_TypeParameters'],
    transfer?: Transferable[],
  ): Promise<E['_TypeReturn']>;
  invoke<E extends RpcEndpoint<unknown[], unknown>>(
    endpoint: E,
    parameters: E['_TypeParameters'],
    transfer?: Transferable[],
  ): Promise<E['_TypeReturn']> | E['_TypeReturn'];
  invoke<E extends RpcEndpoint<unknown[], unknown>>(
    endpoint: E,
    parameters: E['_TypeParameters'],
    transfer: Transferable[] = [],
  ): Promise<E['_TypeReturn']> | E['_TypeReturn'] | void {
    if (endpoint.isSync) {
      const sharedBuffer = endpoint.bufferSize
        ? new SharedArrayBuffer(endpoint.bufferSize + 4)
        : undefined;
      const lock = new SharedArrayBuffer(4);
      const lockViewer = new Int32Array(lock);
      lockViewer[0] = 0;
      const message: RpcMessageDataSync = {
        name: endpoint.name,
        data: parameters,
        sync: true,
        lock: lock,
        buf: sharedBuffer,
      };
      this.port.postMessage(message, { transfer });
      Atomics.wait(lockViewer, 0, 0);
      if (lockViewer[0] === 2) {
        // error
        throw null;
      }
      if (sharedBuffer) {
        const byteLength = (new Uint32Array(sharedBuffer, 0, 4))[0]!;
        const sharedBufferView = new Uint8Array(sharedBuffer, 4, byteLength);
        const localBuf = new Uint8Array(byteLength);
        localBuf.set(sharedBufferView!, 0);
        const ret = localBuf
          ? JSON.parse(
            this.#textDecoder.decode(localBuf),
          ) as E['_TypeParameters']
          : undefined;
        return ret;
      } else {
        return;
      }
    } else {
      if (endpoint.hasReturn) {
        const { promise, resolve, reject } = Promise.withResolvers<
          E['_TypeReturn']
        >();
        const retHandler = Rpc.createRetEndpoint(this.nextRetId);
        this.registerHandler(retHandler!, (returnValue, error) => {
          if (error) reject();
          resolve(returnValue);
        });
        const message: RpcMessageData = {
          name: endpoint.name,
          data: parameters,
          sync: false,
          retId: retHandler?.name,
          hasTransfer: endpoint.hasReturnTransfer,
        };
        this.port.postMessage(message, { transfer });
        return promise;
      } else {
        const message: RpcMessageData = {
          name: endpoint.name,
          data: parameters,
          sync: false,
        };
        this.port.postMessage(message, { transfer });
      }
    }
  }
  /**
   * create a call with callbackify parameters
   */
  createCallbackify<E extends RpcEndpointAsync<unknown[], unknown>>(
    endpoint: E,
    callbackAt: number,
  ): (
    ...params: [...E['_TypeParameters'], (param: E['_TypeReturn']) => void]
  ) => void {
    const call = this.createCall(endpoint);
    return (...params) => {
      const callback = params.at(callbackAt) as (
        param: E['_TypeReturn'],
      ) => void;
      params.splice(callbackAt, 1);
      call(...params).then(callback);
    };
  }
}
