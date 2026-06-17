// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  rstest,
} from '@rstest/core';

describe('reconnect', () => {
  let hash = 0;
  beforeEach(() => {
    rstest.stubGlobal('RSPEEDY_COMPILATION_ID', 'test-compilation-id');
    rstest.resetAllMocks();
    rstest.resetModules();

    hash++;

    rstest.stubGlobal('__webpack_hash__', String(hash));
    rstest.stubGlobal(
      '__resourceQuery',
      '?hostname=example.com&port=8080&protocol=ws',
    );
    rstest.stubGlobal('__webpack_require__', {
      h() {
        return String(hash);
      },
    });
  });

  afterEach(() => {
    rstest.unstubAllGlobals();
  });

  it('should not reloadApp at start up', async () => {
    rstest.mock('../../client/transport.js', { mock: true });
    rstest.mock('../../client/reloadApp.js', { mock: true });

    const { default: reloadApp } = await import('../../client/reloadApp.js');

    await import('../../client/index.js');
    const { LynxTransportClient } = await import('../../client/transport.js');

    // @ts-expect-error mock type
    const mockClientInstance = LynxTransportClient.mock.instances[0];

    const sendMessage = mockClientInstance.onMessage.mock.calls[0][0];

    // this simulates receiving a message from the server and passing it
    // along to the callback of onMessage
    sendMessage(JSON.stringify({ type: 'hot' }));
    sendMessage(JSON.stringify({ type: 'reconnect', data: 10 }));
    sendMessage(
      JSON.stringify({ type: 'hash', data: global.__webpack_hash__ }),
    );
    sendMessage(JSON.stringify({ type: 'ok' }));

    expect(reloadApp).toBeCalledTimes(1);
    expect(reloadApp).toBeCalledWith(
      { hot: true, liveReload: false, reconnect: 10, progress: false },
      {
        // `previousHash === currentHash`, will not trigger HMR
        previousHash: global.__webpack_hash__,
        currentHash: global.__webpack_hash__,
        isReconnecting: false,
      },
    );

    sendMessage(JSON.stringify({ type: 'hash', data: 'source-change-hash' }));
    sendMessage(JSON.stringify({ type: 'ok' }));

    expect(reloadApp).toBeCalledTimes(2);
    expect(reloadApp).toHaveBeenLastCalledWith(
      { hot: true, liveReload: false, reconnect: 10, progress: false },
      {
        // `previousHash !== currentHash`
        previousHash: global.__webpack_hash__,
        currentHash: 'source-change-hash',
        isReconnecting: false,
      },
    );
    // Should not change `__webpack_require__.h()`, HMR will update the runtime module.
    expect(global.__webpack_require__.h()).toBe(global.__webpack_hash__);
  });

  it('should reloadApp when restart dev-server', async () => {
    rstest.mock('../../client/transport.js', { mock: true });
    rstest.mock('../../client/reloadApp.js', { mock: true });

    const { default: reloadApp } = await import('../../client/reloadApp.js');

    await import('../../client/index.js');
    const { LynxTransportClient } = await import('../../client/transport.js');

    // @ts-expect-error mock type
    const mockClientInstance = LynxTransportClient.mock.instances[0];

    const sendMessage = mockClientInstance.onMessage.mock.calls[0][0];

    // this simulates receiving a message from the server and passing it
    // along to the callback of onMessage
    sendMessage(JSON.stringify({ type: 'hot' }));
    sendMessage(JSON.stringify({ type: 'reconnect', data: 10 }));
    sendMessage(
      JSON.stringify({ type: 'hash', data: global.__webpack_hash__ }),
    );
    sendMessage(JSON.stringify({ type: 'ok' }));

    expect(reloadApp).toBeCalledTimes(1);
    expect(reloadApp).toBeCalledWith(
      { hot: true, liveReload: false, reconnect: 10, progress: false },
      {
        // `previousHash === currentHash`, will not trigger HMR
        previousHash: global.__webpack_hash__,
        currentHash: global.__webpack_hash__,
        isReconnecting: false,
      },
    );

    sendMessage(JSON.stringify({ type: 'close' }));
    sendMessage(JSON.stringify({ type: 'hot' }));
    sendMessage(JSON.stringify({ type: 'reconnect', data: 10 }));
    sendMessage(
      JSON.stringify({ type: 'hash', data: 'next-compilation-hash' }),
    );
    sendMessage(JSON.stringify({ type: 'ok' }));

    expect(reloadApp).toBeCalledTimes(2);
    expect(reloadApp).toBeCalledWith(
      { hot: true, liveReload: false, reconnect: 10, progress: false },
      {
        // For reload, we also have `previousHash === currentHash`
        // which will not trigger HMR
        previousHash: 'next-compilation-hash',
        currentHash: 'next-compilation-hash',
        isReconnecting: false,
      },
    );
    // Should change `__webpack_require__.h()`, since we are not triggering any HMR.
    expect(global.__webpack_require__.h()).toBe('next-compilation-hash');

    sendMessage(
      JSON.stringify({ type: 'hash', data: 'source-change-again-hash' }),
    );
    sendMessage(JSON.stringify({ type: 'ok' }));

    expect(reloadApp).toBeCalledTimes(3);
    expect(reloadApp).toHaveBeenLastCalledWith(
      { hot: true, liveReload: false, reconnect: 10, progress: false },
      {
        // `previousHash !== currentHash`, will trigger HMR
        previousHash: 'next-compilation-hash',
        currentHash: 'source-change-again-hash',
        isReconnecting: false,
      },
    );
    // Should not change `__webpack_require__.h()`, HMR will update the runtime module.
    expect(global.__webpack_require__.h()).toBe('next-compilation-hash');
  });
});
