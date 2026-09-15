// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { ReadyState, WebSocketImpl } from './WebSocketImpl.js'
import type { EventMap, LynxWebSocketModule } from './WebSocketImpl.js'

declare const NativeModules: {
  LynxWebSocketModule?: LynxWebSocketModule | undefined
}

/**
 * The implementation of {@link https://developer.mozilla.org/en-US/docs/Web/API/WebSocket | WebSocket}
 * for Lynx.
 *
 * @remarks
 *
 * This only works in environment that has `NativeModules.LynxWebSocketModule`.
 *
 * @public
 */
export class WebSocket {
  /**
   * {@inheritdoc @lynx-js/websocket#ReadyState.CONNECTING}
   */
  static CONNECTING: ReadyState = ReadyState.CONNECTING

  /**
   * {@inheritdoc @lynx-js/websocket#ReadyState.OPEN}
   */
  static OPEN: ReadyState = ReadyState.OPEN

  /**
   * {@inheritdoc @lynx-js/websocket#ReadyState.CLOSING}
   */
  static CLOSING: ReadyState = ReadyState.CLOSING

  /**
   * {@inheritdoc @lynx-js/websocket#ReadyState.CLOSED}
   */
  static CLOSED: ReadyState = ReadyState.CLOSED

  #impl: WebSocketImpl

  /**
   * @param url - The URL to which to connect; this should be the URL to which the WebSocket server will respond.
   * @param protocols - Either a single protocol string or an array of protocol strings. If it is omitted, an empty array is used by default, i.e. `[]`.
   * @param options - Extra options for Lynx only.
   */
  constructor(
    url: string,
    protocols?: string | string[],
    options: { headers?: Record<string, string> } = {},
  ) {
    this.#impl = new WebSocketImpl(
      NativeModules.LynxWebSocketModule,
      url,
      protocols,
      options,
    )
  }

  /**
   * The `addEventListener()` method of the `EventTarget` interface sets up a function that will be called whenever the specified event is delivered to the target.
   * @param type - A case-sensitive string representing the event type to listen for.
   * @param callback - The function that receives a notification. See {@link @lynx-js/websocket#EventMap} for details of events.
   */
  addEventListener<T extends keyof EventMap>(
    type: T,
    callback?: (event: EventMap[T]) => void,
  ): void {
    return this.#impl.addEventListener(type, callback)
  }

  /**
   * The `removeEventListener()` method of the `EventTarget` interface removes an event listener from the WebSocket.
   * @param type - The type of event to stop listening for.
   * @param callback - The function to remove as an event listener.
   */
  removeEventListener<T extends keyof EventMap>(
    type: T,
    callback: (event: EventMap[T]) => void,
  ): void {
    this.#impl.removeEventListener(type, callback)
  }

  /**
   * onmessage is the Web-style callback of {@link WebSocket}.
   *
   * @example
   *
   * ```js
   * const socket = new WebSocket(url)
   * socket.onmessage = ({ data }) => {
   *   // handle data
   * }
   * ```
   * @public
   */
  get onmessage() {
    return this.#impl.onmessage
  }
  set onmessage(callback: ((event: EventMap['message']) => void) | null) {
    this.#impl.onmessage = callback
  }

  /**
   * onopen is the Web-style callback of {@link WebSocket}.
   *
   * @example
   *
   * ```js
   * const socket = new WebSocket(url)
   * socket.onopen = () => {}
   * ```
   * @public
   */
  get onopen() {
    return this.#impl.onopen
  }
  set onopen(callback: ((event: EventMap['open']) => void) | null) {
    this.#impl.onopen = callback
  }

  /**
   * onclose is the Web-style callback of {@link WebSocket}.
   *
   * @example
   *
   * ```js
   * const socket = new WebSocket(url)
   * socket.onclose = ({ code, reason }) => {}
   * ```
   * @public
   */
  get onclose() {
    return this.#impl.onclose
  }
  set onclose(callback: ((event: EventMap['close']) => void) | null) {
    this.#impl.onclose = callback
  }

  /**
   * onerror is the Web-style callback of {@link WebSocket}.
   *
   * @example
   *
   * ```js
   * const socket = new WebSocket(url)
   * socket.onerror = ({ message }) => {}
   * ```
   * @public
   */
  get onerror() {
    return this.#impl.onerror
  }
  set onerror(callback: ((event: EventMap['error']) => void) | null) {
    this.#impl.onerror = callback
  }

  /**
   * The `url` read-only property returns the URL of the {@link WebSocket} passed by the constructor.
   */
  get url(): string {
    return this.#impl.url
  }

  /**
   * The `readyState` read-only property returns the current state of the {@link WebSocket} connection.
   */
  get readyState(): ReadyState {
    return this.#impl.readyState
  }

  /**
   * The WebSocket.protocol read-only property returns the name of the sub-protocol the server selected.
   *
   * @remarks
   * This will be one of the strings specified in the protocols parameter when creating the WebSocket object,
   * or `undefined` until the connection is open.
   */
  get protocol(): string | undefined {
    return this.#impl.protocol
  }

  /**
   * The `send` method send the specified data to be transmitted to the server over the {@link WebSocket} connection.
   *
   * @remarks
   * It will throw an exception if you call `send()` when the connection is in the {@link WebSocket.CONNECTING | CONNECTING } state. If you call `send()` when the connection is in the {@link WebSocket.CLOSING | CLOSING } or {@link WebSocket.CLOSED | CLOSED } states, it will silently discard the data.
   * @param data - The specified data to be transmitted.
   */
  send(data: string): void {
    this.#impl.send(data)
  }

  /**
   * The `ping` method send an empty message to the server over the {@link WebSocket} connection.
   * @remarks
   * It will throw an exception if you call `ping()` when the connection is in the {@link WebSocket.CONNECTING | CONNECTING } state. If you call `ping()` when the connection is in the {@link WebSocket.CLOSING | CLOSING } or {@link WebSocket.CLOSED | CLOSED } states, it will silently discard the data.
   */
  ping(): void {
    this.#impl.ping()
  }

  /**
   * The `close()` method closes the {@link WebSocket} connection or connection attempt, if any.
   *
   * @remarks
   * If the connection is already {@link WebSocket.CLOSED | CLOSED }, this method does nothing.
   */
  close(code?: number, reason?: string): void {
    this.#impl.close(code, reason)
  }
}
