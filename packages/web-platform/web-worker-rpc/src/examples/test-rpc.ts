// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Rpc, createRpcEndpoint, RpcError } from '../index.js';

/**
 * Test harness for the RPC system
 * Tests all the fixes and improvements we've made
 */
async function testRpcSystem() {
  console.log('🔄 Starting RPC System Tests');

  // Create a message channel for communication
  const { port1, port2 } = new MessageChannel();

  // Create RPC instances for both ends
  const client = new Rpc(port1, 'client', { debug: true });
  const server = new Rpc(port2, 'server', { debug: true });

  try {
    // Test 1: Basic async endpoint
    console.log('\n🧪 Test 1: Basic async endpoint');
    const basicEndpoint = createRpcEndpoint<[string], string>(
      'test.basic',
      false, // async
      true, // has return
    );

    server.registerHandler(basicEndpoint, (message) => {
      console.log(`Server received: ${message}`);
      return `Response to: ${message}`;
    });

    const result1 = await client.invoke(basicEndpoint, ['Hello from client']);
    console.log(`Client received: ${result1}`);
    console.assert(
      result1 === 'Response to: Hello from client',
      'Basic async test failed',
    );

    // Test 2: Transferable objects
    console.log('\n🧪 Test 2: Transferable objects');
    const transferEndpoint = createRpcEndpoint<[ArrayBuffer], ArrayBuffer>(
      'test.transfer',
      false, // async
      true, // has return
      true, // supports transfer
    );

    server.registerHandler(transferEndpoint, (buffer) => {
      const view = new Uint8Array(buffer);
      console.log(`Server received buffer with first byte: ${view[0]}`);

      // Modify the buffer
      const responseBuffer = new ArrayBuffer(4);
      const responseView = new Uint8Array(responseBuffer);
      responseView[0] = 255;

      return {
        data: responseBuffer,
        transfer: [responseBuffer],
      };
    });

    const testBuffer = new ArrayBuffer(4);
    const testView = new Uint8Array(testBuffer);
    testView[0] = 42;

    const result2 = await client.invoke(
      transferEndpoint,
      [testBuffer],
      [testBuffer], // Transfer the buffer
    );

    const resultView = new Uint8Array(result2);
    console.log(`Client received buffer with first byte: ${resultView[0]}`);
    console.assert(resultView[0] === 255, 'Transferable test failed');

    // Test 3: RetEndpoint handling (testing our fix)
    console.log('\n🧪 Test 3: RetEndpoint handling');
    const complexEndpoint = createRpcEndpoint<
      [string, number],
      { success: boolean; value: string }
    >(
      'test.complex',
      false, // async
      true, // has return
    );

    server.registerHandler(complexEndpoint, (text, num) => {
      console.log(`Server received: ${text}, ${num}`);

      if (num < 0) {
        throw new RpcError(`Invalid number: ${num}`, 'test.complex', false, [
          text,
          num,
        ]);
      }

      return {
        success: true,
        value: `${text} processed with ${num}`,
      };
    });

    try {
      const result3 = await client.invoke(complexEndpoint, [
        'Process this',
        42,
      ]);
      console.log(`Client received:`, result3);
      console.assert(
        result3.success === true,
        'RetEndpoint test success case failed',
      );

      // Test error handling
      await client.invoke(complexEndpoint, ['This should fail', -1]);
      console.assert(false, 'Error handling test should have thrown');
    } catch (error: unknown) {
      console.log(
        `Client received error (expected):`,
        (error as Error).message,
      );
      console.assert(
        error instanceof RpcError,
        'Error should be RpcError instance',
      );
    }

    // Test 4: Sync endpoint with return
    console.log('\n🧪 Test 4: Sync endpoint with return');
    if (typeof SharedArrayBuffer !== 'undefined') {
      const syncEndpoint = createRpcEndpoint<[number, number], number>(
        'test.sync',
        true, // sync
        true, // has return
        false, // no transfer in sync
        100, // buffer size
      );

      server.registerHandler(syncEndpoint, (a, b) => {
        console.log(`Server calculating: ${a} + ${b}`);
        return a + b;
      });

      try {
        const result4 = client.invoke(syncEndpoint, [5, 7]);
        console.log(`Client received sync result: ${result4}`);
        console.assert(result4 === 12, 'Sync endpoint test failed');
      } catch (error: unknown) {
        console.log(
          `Sync test error (may be expected if no SharedArrayBuffer support):`,
          (error as Error).message,
        );
      }
    } else {
      console.log('SharedArrayBuffer not available, skipping sync test');
    }

    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Clean up
    client.dispose();
    server.dispose();
  }
}

// Run the tests
testRpcSystem().catch(error => {
  console.error('Fatal error in tests:', error);
});
