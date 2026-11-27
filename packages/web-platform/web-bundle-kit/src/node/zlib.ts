// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// `node:zlib` has no browser equivalent: every member throws on use.
// The named exports are the keys of the Node.js 24 module.

import { trap } from './trap.js';

const zlib = trap<typeof import('node:zlib')>('node:zlib');

export const {
  crc32,
  Deflate,
  Inflate,
  Gzip,
  Gunzip,
  DeflateRaw,
  InflateRaw,
  Unzip,
  BrotliCompress,
  BrotliDecompress,
  ZstdCompress,
  ZstdDecompress,
  deflate,
  deflateSync,
  gzip,
  gzipSync,
  deflateRaw,
  deflateRawSync,
  unzip,
  unzipSync,
  inflate,
  inflateSync,
  gunzip,
  gunzipSync,
  inflateRaw,
  inflateRawSync,
  brotliCompress,
  brotliCompressSync,
  brotliDecompress,
  brotliDecompressSync,
  zstdCompress,
  zstdCompressSync,
  zstdDecompress,
  zstdDecompressSync,
  createDeflate,
  createInflate,
  createDeflateRaw,
  createInflateRaw,
  createGzip,
  createGunzip,
  createUnzip,
  createBrotliCompress,
  createBrotliDecompress,
  createZstdCompress,
  createZstdDecompress,
  constants,
  codes,
} = zlib;
export default zlib;
