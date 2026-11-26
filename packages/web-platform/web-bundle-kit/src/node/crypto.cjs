// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Synchronous `createHash` for the digests build tools use to name things
// (sha1 and sha256), and random values from Web Crypto. Web Crypto's
// `subtle.digest` is asynchronous, so it cannot back `createHash`.

const { Buffer } = require('./buffer.cjs');

const rotl = (x, n) => (x << n) | (x >>> (32 - n));
const rotr = (x, n) => (x >>> n) | (x << (32 - n));

function pad(bytes) {
  const length = bytes.length;
  const total = (((length + 8) >> 6) + 1) << 6;
  const out = new Uint8Array(total);
  out.set(bytes);
  out[length] = 0x80;
  const view = new DataView(out.buffer);
  view.setUint32(total - 8, Math.floor(length / 0x20000000), false);
  view.setUint32(total - 4, (length << 3) >>> 0, false);
  return view;
}

function sha1(bytes) {
  const view = pad(bytes);
  let [a0, b0, c0, d0, e0] = [
    0x67452301,
    0xefcdab89,
    0x98badcfe,
    0x10325476,
    0xc3d2e1f0,
  ];
  const w = new Int32Array(80);
  for (let offset = 0; offset < view.byteLength; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getInt32(offset + i * 4, false);
    for (let i = 16; i < 80; i++) {
      w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }
    let [a, b, c, d, e] = [a0, b0, c0, d0, e0];
    for (let i = 0; i < 80; i++) {
      let f = b ^ c ^ d;
      let k = 0xca62c1d6;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      }
      const t = (rotl(a, 5) + f + e + k + w[i]) | 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = t;
    }
    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
    e0 = (e0 + e) | 0;
  }
  return words([a0, b0, c0, d0, e0]);
}

const K256 = [
  0x428a2f98,
  0x71374491,
  0xb5c0fbcf,
  0xe9b5dba5,
  0x3956c25b,
  0x59f111f1,
  0x923f82a4,
  0xab1c5ed5,
  0xd807aa98,
  0x12835b01,
  0x243185be,
  0x550c7dc3,
  0x72be5d74,
  0x80deb1fe,
  0x9bdc06a7,
  0xc19bf174,
  0xe49b69c1,
  0xefbe4786,
  0x0fc19dc6,
  0x240ca1cc,
  0x2de92c6f,
  0x4a7484aa,
  0x5cb0a9dc,
  0x76f988da,
  0x983e5152,
  0xa831c66d,
  0xb00327c8,
  0xbf597fc7,
  0xc6e00bf3,
  0xd5a79147,
  0x06ca6351,
  0x14292967,
  0x27b70a85,
  0x2e1b2138,
  0x4d2c6dfc,
  0x53380d13,
  0x650a7354,
  0x766a0abb,
  0x81c2c92e,
  0x92722c85,
  0xa2bfe8a1,
  0xa81a664b,
  0xc24b8b70,
  0xc76c51a3,
  0xd192e819,
  0xd6990624,
  0xf40e3585,
  0x106aa070,
  0x19a4c116,
  0x1e376c08,
  0x2748774c,
  0x34b0bcb5,
  0x391c0cb3,
  0x4ed8aa4a,
  0x5b9cca4f,
  0x682e6ff3,
  0x748f82ee,
  0x78a5636f,
  0x84c87814,
  0x8cc70208,
  0x90befffa,
  0xa4506ceb,
  0xbef9a3f7,
  0xc67178f2,
];

function sha256(bytes) {
  const view = pad(bytes);
  const h = [
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19,
  ];
  const w = new Int32Array(64);
  for (let offset = 0; offset < view.byteLength; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getInt32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + s1 + ch + K256[i] + w[i]) | 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((value, i) => {
      h[i] = (h[i] + value) | 0;
    });
  }
  return words(h);
}

function words(list) {
  const out = new Uint8Array(list.length * 4);
  const view = new DataView(out.buffer);
  list.forEach((word, i) => view.setUint32(i * 4, word >>> 0, false));
  return out;
}

const algorithms = { sha1, sha256 };

function toBytes(data, encoding) {
  if (typeof data === 'string') return Buffer.from(data, encoding ?? 'utf8');
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(data);
}

function concat(chunks) {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function encode(bytes, encoding) {
  const buffer = Buffer.from(bytes);
  return encoding ? buffer.toString(encoding) : buffer;
}

function createHash(algorithm) {
  const digest = algorithms[String(algorithm).toLowerCase()];
  if (!digest) {
    throw new Error(
      `Digest method not supported in @lynx-js/web-bundle-kit: ${algorithm}`,
    );
  }
  const chunks = [];
  return {
    update(data, encoding) {
      chunks.push(toBytes(data, encoding));
      return this;
    },
    digest(encoding) {
      return encode(digest(concat(chunks)), encoding);
    },
  };
}

module.exports = {
  createHash,
  hash: (algorithm, data, encoding = 'hex') =>
    createHash(algorithm).update(data).digest(encoding),
  getHashes: () => Object.keys(algorithms),
  randomBytes: (size) =>
    Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(size))),
  randomUUID: () => globalThis.crypto.randomUUID(),
  getRandomValues: (array) => globalThis.crypto.getRandomValues(array),
  webcrypto: globalThis.crypto,
};
