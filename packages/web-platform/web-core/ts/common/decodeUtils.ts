/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

export function decodeBinaryMap(
  buffer: Uint8Array,
): Record<string, Uint8Array> {
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  let offset = 0;
  if (buffer.byteLength < 4) {
    throw new Error('Buffer too short for count');
  }
  const count = view.getUint32(offset, true);
  offset += 4;

  const result: Record<string, Uint8Array> = {};
  const decoder = new TextDecoder();

  for (let i = 0; i < count; i++) {
    if (buffer.byteLength < offset + 4) {
      throw new Error('Buffer too short for key length');
    }
    const keyLen = view.getUint32(offset, true);
    offset += 4;

    if (buffer.byteLength < offset + keyLen) {
      throw new Error('Buffer too short for key');
    }
    const key = decoder.decode(buffer.subarray(offset, offset + keyLen));
    offset += keyLen;

    if (buffer.byteLength < offset + 4) {
      throw new Error('Buffer too short for value length');
    }
    const valLen = view.getUint32(offset, true);
    offset += 4;

    if (buffer.byteLength < offset + valLen) {
      throw new Error('Buffer too short for value');
    }
    const val = buffer.subarray(offset, offset + valLen);
    offset += valLen;

    result[key] = val;
  }
  return result;
}
