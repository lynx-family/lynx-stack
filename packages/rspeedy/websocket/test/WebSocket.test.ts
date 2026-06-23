// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createServer } from 'node:http'

import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core'
import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'

import { StubWebSocketModule, stubLynx } from './stubWebSocketModule.js'

// `WebSocketImpl` reads `lynx.getJSModule('GlobalEventEmitter')` at module-eval
// time, and rstest evaluates the `describe.each` `import('../src/index.js')`
// eagerly at collection time — before the `beforeEach` `stubGlobal('lynx')`
// runs. Install the stub now so the module captures the test's emitter.
const globalWithLynx = globalThis as unknown as { lynx: typeof stubLynx }
globalWithLynx.lynx = stubLynx

describe('WebSocket', () => {
  const server = createServer()
  const wss = new WebSocketServer({ server })

  const LynxWebSocketModule = new StubWebSocketModule(
    stubLynx.GlobalEventEmitter,
  )

  beforeEach(() => {
    rstest
      .stubGlobal('lynx', stubLynx)
      .stubGlobal('NativeModules', {
        LynxWebSocketModule,
      })
      .clearAllMocks()

    return () => {
      rstest.unstubAllGlobals()
    }
  })

  beforeAll(async () => {
    // Create a simple Echo server
    wss.on('connection', function connection(ws) {
      ws.on('message', function message(data) {
        ws.send(data)
      })
    })

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        resolve()
      })
    })

    return () => {
      server.close()
    }
  })

  describe.each([
    { name: 'builtin', impl: import('../src/index.js') },
  ])(
    `with $name impl`,
    ({ name, impl }) => {
      async function createWebSocket(protocol?: string | string[]) {
        const { WebSocket } = await impl

        const address = server.address()

        if (!address || typeof address === 'string') {
          throw new TypeError('invalid address')
        }

        const ws = new WebSocket(`ws://localhost:${address.port}`, protocol)

        expect(ws.url).toBe(`ws://localhost:${address.port}`)

        expect(ws.readyState).toBe(WebSocket.CONNECTING)

        await new Promise((resolve, reject) => {
          ws.onopen = resolve
          ws.onerror = reject
        })

        expect(ws.onopen).toStrictEqual(expect.any(Function))
        expect(ws.onerror).toStrictEqual(expect.any(Function))

        expect(ws.readyState).toBe(WebSocket.OPEN)

        return ws
      }

      test('protocol', async () => {
        const ws = await createWebSocket('ws')

        expect(ws.protocol).toBe('ws')
        await wait(100)
      })

      test('protocols', async () => {
        const ws = await createWebSocket(['ws', 'wss'])

        expect(ws.protocol).toBe('ws')
        await wait(100)
      })

      test('connect', async () => {
        const { WebSocket } = await impl

        const ws = await createWebSocket()

        ws.close()

        expect(ws.readyState).toBe(WebSocket.CLOSING)

        await wait(100)

        expect(ws.readyState).toBe(WebSocket.CLOSED)
      })

      test.runIf(name === 'builtin')(
        'connect without WebSocketModule',
        async () => {
          const { WebSocket } = await impl
          rstest.stubGlobal('NativeModules', {})

          const ws = new WebSocket('ws://localhost:3000')

          expect(stubLynx.reportError).toBeCalled()

          expect(ws.readyState).toBe(WebSocket.CONNECTING)
          expect(ws.onmessage).toBeFalsy()
          expect(ws.onopen).toBeFalsy()
          expect(ws.onerror).toBeFalsy()
          expect(ws.onclose).toBeFalsy()
        },
      )

      test('send', async () => {
        const { WebSocket } = await impl
        const ws = await createWebSocket()

        const messages: string[] = []

        ws.onmessage = (event) => {
          messages.push(event.data.toString())
        }

        expect(ws.onmessage).toStrictEqual(expect.any(Function))

        ws.send('foo')

        await wait(100)

        expect(messages).toStrictEqual(['foo'])

        ws.close()

        await wait(100)

        expect(ws.readyState).toBe(WebSocket.CLOSED)
      })

      test('send before connect', async () => {
        const { WebSocket } = await impl

        const address = server.address()

        if (!address || typeof address === 'string') {
          throw new TypeError('invalid address')
        }

        const ws = new WebSocket(`ws://localhost:${address.port}`)

        expect(ws.readyState).toBe(WebSocket.CONNECTING)

        expect(() => ws.send('foo')).toThrowError()

        await new Promise((resolve, reject) => {
          ws.onopen = resolve
          ws.onerror = reject
        })

        expect(ws.readyState).toBe(WebSocket.OPEN)

        ws.close()

        await wait(100)

        expect(ws.readyState).toBe(WebSocket.CLOSED)
      })

      test('send after close', async () => {
        const send = rstest.spyOn(LynxWebSocketModule, 'send')
        const { WebSocket } = await impl
        const ws = await createWebSocket()

        ws.close()
        expect(ws.readyState).toBe(WebSocket.CLOSING)

        // If you call `send()` when the connection is in the {@link WebSocket.CLOSING | CLOSING } or {@link WebSocket.CLOSED | CLOSED } states, it will silently discard the data.
        expect(() => ws.send('foo')).not.toThrowError()

        await wait(100)

        expect(() => ws.send('foo')).not.toThrowError()
        expect(ws.readyState).toBe(WebSocket.CLOSED)

        expect(send).not.toBeCalled()
      })

      test('ping', async () => {
        const { WebSocket } = await impl
        const ws = await createWebSocket()

        const messages: string[] = []

        ws.onmessage = (event) => {
          messages.push(event.data.toString())
        }

        expect(ws.onmessage).toStrictEqual(expect.any(Function))

        ws.ping()

        await wait(100)

        expect(messages).toStrictEqual(name === 'builtin' ? [] : [''])

        ws.close()

        await wait(100)

        expect(ws.readyState).toBe(WebSocket.CLOSED)
      })

      test('ping before connect', async () => {
        const { WebSocket } = await impl

        const address = server.address()

        if (!address || typeof address === 'string') {
          throw new TypeError('invalid address')
        }

        const ws = new WebSocket(`ws://localhost:${address.port}`)

        expect(ws.readyState).toBe(WebSocket.CONNECTING)

        expect(() => ws.ping()).toThrowError()

        await new Promise((resolve, reject) => {
          ws.onopen = resolve
          ws.onerror = reject
        })

        expect(ws.readyState).toBe(WebSocket.OPEN)

        ws.close()

        await wait(100)

        expect(ws.readyState).toBe(WebSocket.CLOSED)
      })

      test('ping after close', async () => {
        const ping = rstest.spyOn(StubWebSocketModule.prototype, 'ping')
        const { WebSocket } = await impl
        const ws = await createWebSocket()

        ws.close()
        expect(ws.readyState).toBe(WebSocket.CLOSING)

        // If you call `ping()` when the connection is in the {@link WebSocket.CLOSING | CLOSING } or {@link WebSocket.CLOSED | CLOSED } states, it will silently discard the data.
        expect(() => ws.ping()).not.toThrowError()

        await wait(100)

        expect(() => ws.ping()).not.toThrowError()
        expect(ws.readyState).toBe(WebSocket.CLOSED)

        expect(ping).not.toBeCalled()
      })

      test('close multiple times', async () => {
        const { WebSocket } = await impl
        const close = rstest.spyOn(StubWebSocketModule.prototype, 'close')
        const ws = await createWebSocket()

        ws.close()
        expect(ws.readyState).toBe(WebSocket.CLOSING)
        expect(close).toBeCalledTimes(1)

        ws.close()
        expect(ws.readyState).toBe(WebSocket.CLOSING)
        expect(close).toBeCalledTimes(1)
        await wait(100)
        expect(ws.readyState).toBe(WebSocket.CLOSED)
        expect(close).toBeCalledTimes(1)
      })

      test('close with code and reason', async () => {
        const { WebSocket } = await impl

        const connPromise = new Promise<WebSocket>((resolve) =>
          wss.once('connection', (socket) => resolve(socket))
        )
        const ws = await createWebSocket()
        const conn = await connPromise
        expect(conn).toBeDefined()

        // close with custom status code in the range 3000-4999.
        const closePromise = new Promise<[number, string | Buffer]>((resolve) =>
          conn.once(
            'close',
            (code, reason) => resolve([code, reason.toString()]),
          )
        )
        const codeAndReason: [number, string] = [4514, 'test']
        ws.close(...codeAndReason)

        expect(ws.readyState).toBe(WebSocket.CLOSING)
        expect(await closePromise).toStrictEqual(codeAndReason)
        await wait(100)
        expect(ws.readyState).toBe(WebSocket.CLOSED)
      })

      test('addEventListener', async () => {
        const { WebSocket } = await impl
        const ws = await createWebSocket()

        const messages: string[] = []

        ws.addEventListener('message', ({ data }) => {
          messages.push(data.toString())
        })

        ws.send('foo')
        ws.send('bar')

        expect(messages).toStrictEqual([])

        ws.close()
        expect(ws.readyState).toBe(WebSocket.CLOSING)
        await wait(100)
        expect(ws.readyState).toBe(WebSocket.CLOSED)
      })
    },
  )
})

function wait(ws: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ws)
  })
}
