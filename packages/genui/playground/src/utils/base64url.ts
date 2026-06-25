// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Minimal base64url helpers for browser runtime (UTF-8 safe).
// Base64url avoids percent-encoding overhead for JSON-heavy payloads.

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) {
    bin += String.fromCharCode(b);
  }
  return window.btoa(bin);
}

function fromBase64(base64: string): Uint8Array {
  const bin = window.atob(base64);
  const out = new Uint8Array(bin.length);
  let i = 0;
  for (const ch of bin) {
    out[i] = ch.charCodeAt(0);
    i += 1;
  }
  return out;
}

export function encodeBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  return toBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll(
    '=',
    '',
  );
}

export function decodeBase64Url(input: string): string {
  // Restore base64 padding and alphabet.
  let base64 = input.replaceAll('-', '+').replaceAll('_', '/');
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';
  else if (pad !== 0) {
    throw new Error('Invalid base64url string');
  }

  const bytes = fromBase64(base64);
  return new TextDecoder().decode(bytes);
}
