// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import { getImageSize } from '../src/platforms/image-size.js';

describe('getImageSize', () => {
  it('rejects PNG buffers that are too short to include dimensions', () => {
    const pngSignature = Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
    ]);

    expect(() => getImageSize(pngSignature, 'png')).toThrow(
      'PNG buffer is too short to read dimensions.',
    );
  });

  it('skips non-SOF JPEG segments before reading dimensions', () => {
    const jpeg = Buffer.from([
      0xff,
      0xd8,
      0xff,
      0xe0,
      0x00,
      0x04,
      0x12,
      0x34,
      0xff,
      0xc0,
      0x00,
      0x0b,
      0x08,
      0x00,
      0x10,
      0x00,
      0x20,
      0x01,
      0x01,
      0x11,
      0x00,
    ]);

    expect(getImageSize(jpeg, 'jpeg')).toEqual({
      height: 16,
      width: 32,
    });
  });
});
