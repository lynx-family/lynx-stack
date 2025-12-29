// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * This test is copied from https://github.com/webpack/webpack-dev-server/blob/975c719e70172938602655b5b78f6bdfe7a0b366/test/client/socket-helper.test.js
 * @license
Copyright JS Foundation and other contributors

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('socket', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('should default to LynxTransportClient when no __webpack_dev_server_client__ set', async () => {
    vi.mock('../../client/transport.js');

    const { default: socket } = await import('../../client/socket.js');
    const { LynxTransportClient } = await import('../../client/transport.js');

    const mockHandler = vi.fn();

    socket('my.url', {
      example: mockHandler,
    });

    // @ts-expect-error mock type
    const mockClientInstance = LynxTransportClient.mock.instances[0];

    // this simulates receiving a message from the server and passing it
    // along to the callback of onMessage
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    mockClientInstance.onMessage.mock.calls[0][0](
      JSON.stringify({
        type: 'example',
        data: 'hello world',
        params: { foo: 'bar' },
      }),
    );

    // @ts-expect-error mock type
    expect(LynxTransportClient.mock.calls[0]).toMatchSnapshot();
    expect(mockClientInstance.onOpen.mock.calls).toMatchSnapshot();
    expect(mockClientInstance.onClose.mock.calls).toMatchSnapshot();
    expect(mockClientInstance.onMessage.mock.calls).toMatchSnapshot();
    expect(mockHandler.mock.calls).toMatchSnapshot();
  });

  it('should use __webpack_dev_server_client__ when set', async () => {
    vi.mock('../../client/clients/WebSocketClient');

    const { default: socket } = await import('../../client/socket.js');

    const { LynxTransportClient } = await import('../../client/transport.js');
    global.__webpack_dev_server_client__ = LynxTransportClient;

    const mockHandler = vi.fn();

    socket('my.url', {
      example: mockHandler,
    });

    const mockClientInstance =
      global.__webpack_dev_server_client__.mock.instances[0];

    // this simulates receiving a message from the server and passing it
    // along to the callback of onMessage
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    mockClientInstance.onMessage.mock.calls[0][0](
      JSON.stringify({
        type: 'example',
        data: 'hello world',
        params: { foo: 'bar' },
      }),
    );

    expect(
      global.__webpack_dev_server_client__.mock.calls[0],
    ).toMatchSnapshot();
    expect(mockClientInstance.onOpen.mock.calls).toMatchSnapshot();
    expect(mockClientInstance.onClose.mock.calls).toMatchSnapshot();
    expect(mockClientInstance.onMessage.mock.calls).toMatchSnapshot();
    expect(mockHandler.mock.calls).toMatchSnapshot();
  });

  it('should export initialized client', async () => {
    const { default: socket, client: nonInitializedInstance } = await import(
      '../../client/socket.js'
    );

    expect(nonInitializedInstance).toBe(null);

    socket('my.url', {});

    const { client: initializedInstance } = await import(
      '../../client/socket.js'
    );

    expect(initializedInstance).not.toBe(null);
    expect(typeof initializedInstance!.onClose).toBe('function');
    expect(typeof initializedInstance!.onMessage).toBe('function');
    expect(typeof initializedInstance!.onOpen).toBe('function');
  });
});
