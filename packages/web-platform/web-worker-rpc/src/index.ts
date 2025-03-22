// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export { Rpc } from './Rpc.js';

export type { RpcOptions } from './Rpc.js';

export { createRpcEndpoint, RpcError } from './RpcEndpoint.js';

export type {
  RpcEndpoint,
  RpcEndpointAsync,
  RpcEndpointAsyncVoid,
  RpcEndpointAsyncWithTransfer,
  RpcEndpointSync,
  RpcEndpointSyncVoid,
  RpcEndpointBase,
  EndpointParameters,
  EndpointReturnType,
} from './RpcEndpoint.js';

export { hasTransferableObjects, extractTransferables } from './TypeUtils.js';

export type { RpcCallType, TransferableObject } from './TypeUtils.js';
