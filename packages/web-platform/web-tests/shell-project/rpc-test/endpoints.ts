import { createRpcEndpoint } from '@lynx-js/web-worker-rpc';

export const addAsync = createRpcEndpoint<[number, number], number>(
  'add_async',
  false,
  true,
  false,
);

export const addSync = createRpcEndpoint<[number, number], number>(
  'add_sync',
  true,
  true,
  false,
  16,
);

export const consoleLog = createRpcEndpoint<[string]>(
  'console_log',
  false,
  true,
  false,
);

export const consoleLogSync = createRpcEndpoint<[string]>(
  'console_log_sync',
  true,
  false,
);

export const throwError = createRpcEndpoint<[]>(
  'throw_async',
  false,
  true,
  false,
);

export const throwErrorSync = createRpcEndpoint<[]>('throw_sync', true, false);

export const wait = createRpcEndpoint<[number]>(
  'wait_async',
  false,
  true,
  false,
);

export const waitSync = createRpcEndpoint<[number]>('wait_async', true, false);

export const testLazy = createRpcEndpoint<[number, number], number>(
  'add_lazy',
  false,
  true,
  false,
);

export const addAsyncWithTransfer = createRpcEndpoint(
  'add_async_with_transfer',
  false,
  true,
  true,
);
