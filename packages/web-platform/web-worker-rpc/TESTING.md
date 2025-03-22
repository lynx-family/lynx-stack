# Testing the RPC System Changes

This document explains how to test the changes made to the RPC communication system in the `@web-platform` package.

## Test Suite Overview

We've created comprehensive tests to verify all the improvements and fixes made to the RPC system:

1. **Node.js Tests**: Run tests in a Node.js environment
2. **Browser Tests**: Run tests in a browser environment (with UI)

These tests validate:

- Type safety with RetEndpoint handling
- Transferable objects support
- Error handling improvements
- Environment compatibility
- Synchronous and asynchronous call patterns

## Running the Tests

### Prerequisites

Make sure you have the latest dependencies installed:

```bash
pnpm install
```

### Node.js Tests

Run the following command:

```bash
pnpm run test:rpc
```

This command:

1. Compiles TypeScript files
2. Runs the test script that verifies RPC functionality
3. Shows test results in the console

Expected output should end with:

```
✅ All tests completed!
Tests completed successfully!
```

Note: The synchronous test with SharedArrayBuffer may fail in Node.js depending on your environment configuration, which is expected behavior.

### Browser Tests

Run the following command:

```bash
pnpm run test:browser
```

This command:

1. Compiles TypeScript files
2. Starts a local server with COOP/COEP headers (needed for SharedArrayBuffer)
3. Open your browser to http://localhost:3000/

Once the page loads:

1. Click the "Run Tests" button to execute tests
2. Watch the test results appear in the results section
3. All tests should pass with ✅ indicators

## Test Files

- `test-rpc.js`: Script to run Node.js tests
- `src/examples/test-rpc.ts`: TypeScript test implementations
- `src/examples/browser-test.html`: Browser test UI
- `serve-test.js`: Server for browser tests

## Troubleshooting

- If you see issues with SharedArrayBuffer, that's expected in environments that don't support it or don't have cross-origin isolation.
- If you see module errors, ensure you're using the latest NodeJS version that supports ES modules.
