# @lynx-js/web-worker-rpc

A type-safe RPC (Remote Procedure Call) system for communication between threads in Lynx applications.

## Features

- **Type-safe API**: Full TypeScript type checking for endpoint definitions, parameters, and return values
- **Synchronous and asynchronous calls**: Support for both blocking and non-blocking calls
- **Transferable objects**: Efficient handling of transferable objects like ArrayBuffer
- **Error handling**: Proper error propagation between threads
- **Timeout support**: Configurable timeouts for synchronous calls
- **Debugging support**: Optional debug logging for messages

## Usage

### Creating endpoints

Define the communication contract between threads by creating endpoints:

```typescript
import { createRpcEndpoint } from '@lynx-js/web-worker-rpc';

// Synchronous endpoint without return value
const pingEndpoint = createRpcEndpoint<[message: string]>(
  'ping', // Unique name
  true, // isSync
  false, // hasReturn
);

// Synchronous endpoint with return value
const sumEndpoint = createRpcEndpoint<[a: number, b: number], number>(
  'sum', // Unique name
  true, // isSync
  true, // hasReturn
  false, // hasReturnTransfer
  1024, // bufferSize (required for sync endpoints with return)
);

// Asynchronous endpoint with return value
const fetchDataEndpoint = createRpcEndpoint<[id: string], { data: string }>(
  'fetchData', // Unique name
  false, // isSync
  true, // hasReturn
);

// Asynchronous endpoint with transferable return
const getImageDataEndpoint = createRpcEndpoint<
  [id: string],
  { buffer: ArrayBuffer; width: number; height: number }
>(
  'getImageData', // Unique name
  false, // isSync
  true, // hasReturn
  true, // hasReturnTransfer
);
```

### Setting up communication

Create a message channel and RPC instances:

```typescript
const channel = new MessageChannel();
const port1 = channel.port1;
const port2 = channel.port2;

// For main thread
const mainThreadRpc = new Rpc(port1, 'mainThread', {
  debug: true, // Enable debug logging
  syncTimeout: 5000, // 5 second timeout for sync calls
});

// For worker thread
const workerThreadRpc = new Rpc(port2, 'workerThread');
```

### Registering handlers

Register handlers for endpoints on the receiving side:

```typescript
// Basic handler
workerThreadRpc.registerHandler(pingEndpoint, (message) => {
  console.log(`Received ping: ${message}`);
});

// Handler with return value
workerThreadRpc.registerHandler(sumEndpoint, (a, b) => {
  return a + b;
});

// Async handler
workerThreadRpc.registerHandler(fetchDataEndpoint, async (id) => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 100));
  return { data: `Data for ${id}` };
});

// Handler with transferable objects
workerThreadRpc.registerHandler(getImageDataEndpoint, async (id) => {
  const buffer = new ArrayBuffer(1024);
  // Fill buffer with data...

  return {
    data: {
      buffer,
      width: 100,
      height: 100,
    },
    transfer: [buffer], // Specify which objects to transfer
  };
});
```

### Calling endpoints

Create type-safe function calls from endpoints:

```typescript
// Create typed function calls
const ping = mainThreadRpc.createCall(pingEndpoint);
const sum = mainThreadRpc.createCall(sumEndpoint);
const fetchData = mainThreadRpc.createCall(fetchDataEndpoint);
const getImageData = mainThreadRpc.createCall(getImageDataEndpoint);

// Call them with proper typing
ping('Hello'); // void
const result = sum(5, 10); // number
const dataPromise = fetchData('user123'); // Promise<{ data: string }>
const imageDataPromise = getImageData('image1'); // Promise<{ buffer: ArrayBuffer, width: number, height: number }>
```

### Error handling

Handle errors properly:

```typescript
try {
  const data = await fetchData('invalid');
} catch (error) {
  if (error instanceof RpcError) {
    console.error(`RPC Error in ${error.endpointName}: ${error.message}`);
    // Access additional context about the error
    console.error(`Call arguments:`, error.args);
    console.error(`Was sync call:`, error.isSync);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Transferable Objects

When working with large data like ArrayBuffers, use transferable objects for better performance:

```typescript
// Utility to extract all transferable objects from a complex object
import { extractTransferables } from '@lynx-js/web-worker-rpc';

const complexObject = {
  buffers: [new ArrayBuffer(100), new ArrayBuffer(200)],
  nested: { buffer: new ArrayBuffer(300) },
};

const transferables = extractTransferables(complexObject);
// Use transferables in your call
```

### Cleanup

Always clean up resources when done:

```typescript
// Dispose RPC instances to clean up resources
mainThreadRpc.dispose();
workerThreadRpc.dispose();
```

## API Reference

### Classes

- `Rpc`: Main class for handling RPC communication
- `RpcError`: Error class for RPC-specific errors

### Functions

- `createRpcEndpoint()`: Create a type-safe endpoint definition
- `extractTransferables()`: Utility to extract transferable objects from complex objects
- `hasTransferableObjects()`: Check if an object contains transferable objects

### Types

- `RpcEndpoint`: Union type for all endpoint types
- `RpcEndpointSync`: Type for synchronous endpoints with return values
- `RpcEndpointSyncVoid`: Type for synchronous endpoints without return values
- `RpcEndpointAsync`: Type for asynchronous endpoints with return values
- `RpcEndpointAsyncVoid`: Type for asynchronous endpoints without return values
- `RpcEndpointAsyncWithTransfer`: Type for asynchronous endpoints with transferable return values
- `RpcCallType`: Type for functions created by `createCall()`
- `TransferableObject`: Type for objects that can be transferred between threads

## Example

See the `examples/example-usage.ts` file for a complete working example.

## Notes

- For synchronous calls with return values, the browser must support `SharedArrayBuffer`, which requires Cross-Origin Isolation.
- Always prefer asynchronous calls when possible for better performance and to avoid blocking the main thread.
- Be mindful of the data size when using synchronous calls with return values, as you need to specify a buffer size large enough for the JSON-encoded return value.
