// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { rstest } from '@rstest/core'
import { EventEmitter } from 'eventemitter3'
import { WebSocket } from 'ws'

import type {
  GlobalWebSocketEvent,
  LynxWebSocketModule,
} from '../src/WebSocketImpl.js'

export const stubLynx = {
  getJSModule(module: string) {
    if (module === 'GlobalEventEmitter') {
      return stubLynx.GlobalEventEmitter
    }
    return null
  },

  GlobalEventEmitter: new EventEmitter<GlobalWebSocketEvent>(),

  reportError: rstest.fn(),
}

export class StubWebSocketModule implements LynxWebSocketModule {
  constructor(
    public emitter: EventEmitter<GlobalWebSocketEvent>,
  ) {}

  connect(
    url: string,
    protocols: string[],
    options: { headers?: Record<string, string> | undefined },
    socketID: number,
  ): void {
    const ws = new WebSocket(url, protocols, { headers: options.headers })

    ws.addEventListener('open', (event) => {
      this.emitter.emit(
        'websocketOpen',
        Object.assign(event, {
          id: socketID,
          protocol: event.target.protocol,
        }),
      )
    })

    ws.addEventListener('message', (event) => {
      this.emitter.emit(
        'websocketMessage',
        // @ts-expect-error Type 'string' is not assignable to type '"text"'
        Object.assign(event, { id: socketID }),
      )
    })

    ws.addEventListener('close', (event) => {
      this.emitter.emit(
        'websocketClosed',
        Object.assign(event, { id: socketID }),
      )
    })

    ws.addEventListener('error', (event) => {
      this.emitter.emit(
        'websocketFailed',
        Object.assign(event, { id: socketID }),
      )
    })

    this.#wsMap.set(socketID, ws)
  }

  send(message: string, socketID: number): void {
    this.#wsMap.get(socketID)?.send(message)
  }

  ping(socketID: number): void {
    this.#wsMap.get(socketID)?.ping()
  }

  close(code: number, reason: string, socketID: number): void {
    this.#wsMap.get(socketID)?.close(code, reason)
  }

  #wsMap = new Map<number, WebSocket>()
}
