// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Base interface for all RPC endpoint types
 * Defines the common structure and type parameters that all endpoints share
 */
export interface RpcEndpointBase<
  Parameters extends unknown[],
  Return,
  IsSync extends boolean,
  HasReturn extends boolean,
> {
  /**
   * The name of this RPC endpoint.
   * Used by the RPC system to identify which handler to call.
   * Must be unique within the message channel context.
   */
  readonly name: string;

  /**
   * Type parameter for the function arguments
   * @internal Used for TypeScript type inference
   */
  readonly _TypeParameters: Parameters;

  /**
   * Type parameter for the function return value
   * @internal Used for TypeScript type inference
   */
  readonly _TypeReturn: Return;

  /**
   * Indicates if this endpoint returns a value
   * Always true for async endpoints with return values
   * Can be false for sync endpoints that don't return values
   */
  readonly hasReturn: HasReturn;

  /**
   * Indicates if this is a synchronous call
   * Synchronous calls block the caller thread until completion
   */
  readonly isSync: IsSync;

  /**
   * The byte size for return value buffer (for sync calls)
   * Only applicable for synchronous endpoints that return values
   * Must be large enough to hold the UTF-8 encoded JSON string of the return value
   */
  readonly bufferSize: never | number;

  /**
   * Indicates if the return value supports transferable objects
   * Only applicable for async endpoints with return values
   */
  readonly hasReturnTransfer: never | boolean;
}

/**
 * Endpoint type for synchronous calls that don't return a value
 */
export type RpcEndpointSyncVoid<Parameters extends unknown[]> = RpcEndpointBase<
  Parameters,
  void,
  true,
  false
>;

/**
 * Endpoint type for synchronous calls that return a value
 * Requires a buffer size to be specified for the return value
 */
export interface RpcEndpointSync<Parameters extends unknown[], Return>
  extends RpcEndpointBase<Parameters, Return, true, true>
{
  readonly bufferSize: number;
}

/**
 * Endpoint type for asynchronous calls that return a value
 * Does not support transferable objects in the return value
 */
export interface RpcEndpointAsync<
  Parameters extends unknown[],
  Return,
> extends RpcEndpointBase<Parameters, Return, false, true> {
  readonly hasReturnTransfer: false;
}

/**
 * Endpoint type for asynchronous calls that return a value with transferable objects
 * Supports transferable objects in the return value
 */
export interface RpcEndpointAsyncWithTransfer<
  Parameters extends unknown[],
  Return,
> extends RpcEndpointBase<Parameters, Return, false, true> {
  readonly hasReturnTransfer: true;
}

/**
 * Endpoint type for asynchronous calls that don't return a value
 */
export type RpcEndpointAsyncVoid<Parameters extends unknown[]> =
  RpcEndpointBase<
    Parameters,
    void,
    false,
    false
  >;

/**
 * Union type representing all possible RPC endpoint types
 */
export type RpcEndpoint<Parameters extends unknown[], Return> =
  | RpcEndpointSyncVoid<Parameters>
  | RpcEndpointSync<Parameters, Return>
  | RpcEndpointAsync<Parameters, Return>
  | RpcEndpointAsyncVoid<Parameters>
  | RpcEndpointAsyncWithTransfer<Parameters, Return>;

/**
 * Error class for RPC-specific errors
 * Provides additional context about the failed RPC call
 */
export class RpcError extends Error {
  constructor(
    message: string,
    public readonly endpointName: string,
    public readonly isSync: boolean,
    public readonly args?: unknown[],
  ) {
    super(`RPC Error (${endpointName}): ${message}`);
    this.name = 'RpcError';
  }
}

/**
 * Creates an asynchronous endpoint that doesn't return a value
 */
export function createRpcEndpoint<Parameters extends unknown[], Return = void>(
  name: string,
  isSync: false,
  hasReturn: false,
): RpcEndpointAsyncVoid<Parameters>;

/**
 * Creates an asynchronous endpoint that returns a value
 */
export function createRpcEndpoint<Parameters extends unknown[], Return = void>(
  name: string,
  isSync: false,
  hasReturn: true,
): RpcEndpointAsync<Parameters, Return>;

/**
 * Creates an asynchronous endpoint that returns a value and doesn't support transferable objects
 */
export function createRpcEndpoint<Parameters extends unknown[], Return = void>(
  name: string,
  isSync: false,
  hasReturn: true,
  hasReturnTransfer: false,
): RpcEndpointAsync<Parameters, Return>;

/**
 * Creates an asynchronous endpoint that returns a value and supports transferable objects
 */
export function createRpcEndpoint<Parameters extends unknown[], Return = void>(
  name: string,
  isSync: false,
  hasReturn: true,
  hasReturnTransfer: true,
): RpcEndpointAsyncWithTransfer<Parameters, Return>;

/**
 * Creates a synchronous endpoint that doesn't return a value
 */
export function createRpcEndpoint<Parameters extends unknown[]>(
  name: string,
  isSync: true,
  hasReturn: false,
): RpcEndpointSyncVoid<Parameters>;

/**
 * Creates a synchronous endpoint that returns a value
 * Requires a buffer size to be specified for the return value
 */
export function createRpcEndpoint<Parameters extends unknown[], Return>(
  name: string,
  isSync: true,
  hasReturn: true,
  hasReturnTransfer: false,
  bufferSize: number,
): RpcEndpointSync<Parameters, Return>;

/**
 * Implementation of the createRpcEndpoint function
 * Creates and returns an RPC endpoint with the specified configuration
 *
 * @param name Unique name for the endpoint
 * @param isSync Whether the call is synchronous
 * @param hasReturn Whether the endpoint returns a value
 * @param hasReturnTransfer Whether the return value supports transferable objects
 * @param bufferSize Size of the buffer for synchronous return values
 * @returns A properly typed RPC endpoint
 */
export function createRpcEndpoint<Parameters extends unknown[], Return>(
  name: string,
  isSync: boolean,
  hasReturn: boolean = true,
  hasReturnTransfer: boolean = false,
  bufferSize?: number,
): RpcEndpoint<Parameters, Return> {
  if (isSync && hasReturn && bufferSize === undefined) {
    throw new Error(
      `Sync endpoint with return value (${name}) must specify bufferSize`,
    );
  }

  if (!isSync && hasReturnTransfer && !hasReturn) {
    throw new Error(
      `Async endpoint with transfer (${name}) must have return value`,
    );
  }

  return {
    name,
    isSync,
    hasReturn,
    hasReturnTransfer: hasReturnTransfer ? true : false,
    bufferSize,
  } as RpcEndpoint<Parameters, Return>;
}

/**
 * Helper type to extract the parameter types from an RPC endpoint
 */
export type EndpointParameters<T extends RpcEndpoint<unknown[], unknown>> =
  T extends RpcEndpoint<infer P, unknown> ? P : never;

/**
 * Helper type to extract the return type from an RPC endpoint
 */
export type EndpointReturnType<T extends RpcEndpoint<unknown[], unknown>> =
  T extends RpcEndpoint<unknown[], infer R> ? R : never;
