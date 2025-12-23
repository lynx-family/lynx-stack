import { createRpcEndpoint } from '../dist/index.js';

export const addAsync = createRpcEndpoint(
  'add_async',
  false,
  true,
  false,
);

export const addSync = createRpcEndpoint(
  'add_sync',
  true,
  true,
  false,
  16,
);

export const throwError = createRpcEndpoint(
  'throw_async',
  false,
  true,
  false,
);

export const throwErrorSync = createRpcEndpoint('throw_sync', true, false);

export const wait = createRpcEndpoint(
  'wait_async',
  false,
  true,
  false,
);

export const waitSync = createRpcEndpoint('wait_async', true, false);

export const testLazy = createRpcEndpoint(
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

export const changeLazyHandler = createRpcEndpoint(
  'change_lazy_handler',
  false,
  true,
  false,
);

export const removeLazyHandler = createRpcEndpoint(
  'remove_lazy_handler',
  false,
  true,
  false,
);
