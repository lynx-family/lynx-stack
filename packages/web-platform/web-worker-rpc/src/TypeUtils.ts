import type {
  RpcEndpoint,
  RpcEndpointAsync,
  RpcEndpointAsyncVoid,
  RpcEndpointSync,
  RpcEndpointSyncVoid,
} from './RpcEndpoint.js';

export type RpcCallType<E extends RpcEndpoint<unknown[], unknown>> = E extends
  RpcEndpointSync<unknown[], unknown>
  ? (...args: E['_TypeParameters']) => E['_TypeReturn']
  : E extends RpcEndpointSyncVoid<unknown[]>
    ? (...args: E['_TypeParameters']) => void
  : E extends RpcEndpointAsync<unknown[], unknown>
    ? (...args: E['_TypeParameters']) => Promise<E['_TypeReturn']>
  : E extends RpcEndpointAsyncVoid<unknown[]>
    ? (...args: E['_TypeParameters']) => void
  : never;
