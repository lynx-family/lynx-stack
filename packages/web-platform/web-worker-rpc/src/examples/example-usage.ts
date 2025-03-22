// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * This file demonstrates how to use the enhanced RPC system
 *
 * It shows:
 * 1. How to create endpoints
 * 2. How to create an RPC instance
 * 3. How to register handlers for endpoints
 * 4. How to call endpoints
 * 5. How to handle errors
 */

import {
  Rpc,
  createRpcEndpoint,
  RpcError,
  extractTransferables,
} from '../index.js';

// Example: Setting up communication between main thread and worker

// Step 1: Define the endpoints
// Sync endpoint without return
const pingEndpoint = createRpcEndpoint<[message: string]>(
  'ping',
  true, // isSync
  false, // hasReturn
);

// Sync endpoint with return
const sumSyncEndpoint = createRpcEndpoint<[a: number, b: number], number>(
  'sumSync',
  true, // isSync
  true, // hasReturn
  false, // hasReturnTransfer
  1024, // bufferSize - important for sync endpoints with return values
);

// Async endpoint without return
const logEndpoint = createRpcEndpoint<[level: string, message: string]>(
  'log',
  false, // isSync
  false, // hasReturn
);

// Async endpoint with return
const fetchDataEndpoint = createRpcEndpoint<[id: string], { data: string }>(
  'fetchData',
  false, // isSync
  true, // hasReturn
);

// Async endpoint with transferable return
const getImageDataEndpoint = createRpcEndpoint<
  [id: string],
  { buffer: ArrayBuffer; width: number; height: number }
>(
  'getImageData',
  false, // isSync
  true, // hasReturn
  true, // hasReturnTransfer
);

// Step 2: Create a message channel for communication
const channel = new MessageChannel();
const port1 = channel.port1;
const port2 = channel.port2;

// Step 3: Create RPC instances for both sides
const mainThreadRpc = new Rpc(port1, 'mainThread', { debug: true });
const workerThreadRpc = new Rpc(port2, 'workerThread', { debug: true });

// Step 4: Register handlers

// On the worker thread, register handlers for the endpoints
workerThreadRpc.registerHandler(pingEndpoint, (message) => {
  console.log(`Worker received ping: ${message}`);
});

workerThreadRpc.registerHandler(sumSyncEndpoint, (a, b) => {
  return a + b;
});

workerThreadRpc.registerHandler(fetchDataEndpoint, async (id) => {
  // Simulate async data fetching
  await new Promise(resolve => setTimeout(resolve, 100));

  if (id === 'invalid') {
    throw new Error('Invalid ID');
  }

  return { data: `Data for ${id}` };
});

workerThreadRpc.registerHandler(getImageDataEndpoint, async () => {
  // Create a sample ArrayBuffer (in real code, this might be image data)
  const buffer = new ArrayBuffer(1024);
  const view = new Uint8Array(buffer);

  // Fill with sample data
  for (let i = 0; i < view.length; i++) {
    view[i] = i % 256;
  }

  return {
    data: {
      buffer,
      width: 100,
      height: 100,
    },
    transfer: [buffer], // Specify buffers to transfer
  };
});

// Step 5: Create typed function calls on the main thread
const ping = mainThreadRpc.createCall(pingEndpoint);
const sumSync = mainThreadRpc.createCall(sumSyncEndpoint);
const log = mainThreadRpc.createCall(logEndpoint);
const fetchData = mainThreadRpc.createCall(fetchDataEndpoint);
const getImageData = mainThreadRpc.createCall(getImageDataEndpoint);

// Register a handler for the log endpoint on the main thread
mainThreadRpc.registerHandler(logEndpoint, (level, message) => {
  console.log(`[${level}] ${message}`);
});

// Step 6: Using the RPC functions

// Example of using the RPC system
async function runExample() {
  try {
    // Sync calls
    ping('Hello from main thread');
    const sum = sumSync(5, 10);
    console.log(`Sum: ${sum}`); // 15

    // Async calls
    log('info', 'This is a log message');

    // Async call with return value
    const data = await fetchData('user123');
    console.log('Fetched data:', data); // { data: 'Data for user123' }

    // Async call with error handling
    try {
      console.log('This should not be reached');
    } catch (error) {
      if (error instanceof RpcError) {
        console.error(`RPC Error in ${error.endpointName}: ${error.message}`);
      } else {
        console.error('Unexpected error:', error);
      }
    }

    // Async call with transferable objects
    const imageData = await getImageData('image1');
    console.log(
      `Received image: ${imageData.width}x${imageData.height}, buffer size: ${imageData.buffer.byteLength}`,
    );

    // Demonstrating the extractTransferables utility
    const complexObject = {
      id: 'test',
      buffers: [new ArrayBuffer(100), new ArrayBuffer(200)],
      nested: {
        buffer: new ArrayBuffer(300),
      },
    };

    const transferables = extractTransferables(complexObject);
    console.log(`Found ${transferables.length} transferable objects`);
  } catch (error) {
    console.error('Error in example:', error);
  } finally {
    // Clean up resources
    mainThreadRpc.dispose();
    workerThreadRpc.dispose();
  }
}

// Run the example
runExample().catch(console.error);
