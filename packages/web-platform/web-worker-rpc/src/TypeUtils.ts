// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RpcEndpoint } from './RpcEndpoint.js';

/**
 * Gets the type of a function that calls an RPC endpoint
 * Useful for defining types for functions created by `createCall`
 */
export type RpcCallType<E extends RpcEndpoint<any[], any>> = (
  ...args: E['_TypeParameters']
) => E['isSync'] extends true ? E['hasReturn'] extends true ? E['_TypeReturn']
  : void
  : E['hasReturn'] extends true ? Promise<E['_TypeReturn']>
  : void;

/**
 * Type for a transferable object that can be transferred between threads
 * This is a more specific type than the built-in Transferable
 */
export type TransferableObject =
  | ArrayBuffer
  | MessagePort
  | ImageBitmap
  | OffscreenCanvas
  | ReadableStream
  | WritableStream
  | TransformStream;

/**
 * Checks if an object contains transferable objects that need special handling
 * @param object Object to check
 * @returns True if the object has transferable objects
 */
export function hasTransferableObjects(object: unknown): boolean {
  if (!object || typeof object !== 'object') {
    return false;
  }

  if (
    object instanceof ArrayBuffer
    || object instanceof MessagePort
    || object instanceof ImageBitmap
    || (typeof OffscreenCanvas !== 'undefined'
      && object instanceof OffscreenCanvas)
    || object instanceof ReadableStream
    || object instanceof WritableStream
    || object instanceof TransformStream
  ) {
    return true;
  }

  // Check arrays
  if (Array.isArray(object)) {
    return object.some(hasTransferableObjects);
  }

  // Check objects
  return Object.values(object).some(hasTransferableObjects);
}

/**
 * Extracts all transferable objects from a complex object
 * @param object Object that may contain transferable objects
 * @returns Array of transferable objects
 */
export function extractTransferables(object: unknown): Transferable[] {
  const transferables: Transferable[] = [];

  if (!object || typeof object !== 'object') {
    return transferables;
  }

  if (
    object instanceof ArrayBuffer
    || object instanceof MessagePort
    || object instanceof ImageBitmap
    || (typeof OffscreenCanvas !== 'undefined'
      && object instanceof OffscreenCanvas)
    || object instanceof ReadableStream
    || object instanceof WritableStream
    || object instanceof TransformStream
  ) {
    transferables.push(object as Transferable);
    return transferables;
  }

  // Process arrays
  if (Array.isArray(object)) {
    for (const item of object) {
      transferables.push(...extractTransferables(item));
    }
    return transferables;
  }

  // Process objects
  for (const value of Object.values(object)) {
    transferables.push(...extractTransferables(value));
  }

  return transferables;
}
