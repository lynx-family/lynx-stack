// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Synchronous `createHash` for the digests build tools use to name things
// (sha1 and sha256), from @noble/hashes, and random values from Web Crypto.
// Web Crypto's `subtle.digest` is asynchronous, so it cannot back
// `createHash`.

import { sha1 } from '@noble/hashes/legacy.js';
import { sha256 } from '@noble/hashes/sha2.js';

import { Buffer } from './buffer.js';

type Encoding = BufferEncoding;

type HashInput = string | ArrayBufferView | ArrayBuffer | ArrayLike<number>;

/** What `createHash` returns: the part of Node.js's `Hash` build tools use. */
interface Hash {
  update(data: HashInput, encoding?: Encoding): Hash;
  /** A Buffer, or a string when `encoding` is given. */
  digest(encoding?: Encoding): Buffer | string;
}

const algorithms = { sha1, sha256 };

function toBytes(data: HashInput, encoding?: Encoding): Uint8Array {
  if (typeof data === 'string') return Buffer.from(data, encoding ?? 'utf8');
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(data);
}

function createHash(algorithm: string): Hash {
  const name = String(algorithm).toLowerCase();
  if (!Object.hasOwn(algorithms, name)) {
    throw new Error(
      `Digest method not supported in @lynx-js/web-bundle-kit: ${algorithm}`,
    );
  }
  // Each `update` feeds the hash. As in Node.js, a hash gives one digest.
  const state = algorithms[name as keyof typeof algorithms].create();
  return {
    update(data, encoding) {
      state.update(toBytes(data, encoding));
      return this;
    },
    digest(encoding) {
      const buffer = Buffer.from(state.digest());
      return encoding ? buffer.toString(encoding) : buffer;
    },
  };
}

const crypto = {
  createHash,
  hash: (algorithm: string, data: HashInput, encoding: Encoding = 'hex') =>
    createHash(algorithm).update(data).digest(encoding),
  getHashes: () => Object.keys(algorithms),
  randomBytes: (size: number) =>
    Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(size))),
  randomUUID: () => globalThis.crypto.randomUUID(),
  getRandomValues: <T extends ArrayBufferView<ArrayBuffer>>(array: T) =>
    globalThis.crypto.getRandomValues(array),
  webcrypto: globalThis.crypto,
} satisfies Partial<Record<keyof typeof import('node:crypto'), unknown>>;

export const {
  hash,
  getHashes,
  randomBytes,
  randomUUID,
  getRandomValues,
  webcrypto,
} = crypto;
export { createHash };
export default crypto;
