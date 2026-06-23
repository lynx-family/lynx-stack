// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export type SupportedImageFormat = 'jpeg' | 'png';

export interface Size {
  height: number;
  width: number;
}

export function getImageFormat(buffer: Buffer): SupportedImageFormat {
  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
  ) {
    return 'png';
  }

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return 'jpeg';
  }

  throw new Error('Unsupported Kitten-Lynx screenshot format.');
}

export function getImageSize(
  buffer: Buffer,
  format: SupportedImageFormat,
): Size {
  if (format === 'png') {
    if (buffer.length < 24) {
      throw new Error('PNG buffer is too short to read dimensions.');
    }

    return {
      height: buffer.readUInt32BE(20),
      width: buffer.readUInt32BE(16),
    };
  }

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      break;
    }

    if (offset + 4 >= buffer.length) {
      break;
    }

    const marker = buffer.readUInt8(offset + 1);
    const length = buffer.readUInt16BE(offset + 2);
    const isStartOfFrame = marker >= 0xc0
      && marker <= 0xcf
      && marker !== 0xc4
      && marker !== 0xc8
      && marker !== 0xcc;

    if (!isStartOfFrame) {
      offset += 2 + length;
      continue;
    }

    if (offset + 8 >= buffer.length) {
      break;
    }

    return {
      height: buffer.readUInt16BE(offset + 5),
      width: buffer.readUInt16BE(offset + 7),
    };
  }

  throw new Error('Unable to read Kitten-Lynx screenshot dimensions.');
}
