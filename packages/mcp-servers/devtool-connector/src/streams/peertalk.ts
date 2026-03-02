// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { TransformStream } from 'node:stream/web';

import type { Response } from '../types.ts';

export class PeertalkToMessageTransformStream
  extends TransformStream<Uint8Array, Response>
{
  constructor() {
    let buffer = new Uint8Array(0); // Buffer for partial frames
    const decoder = new TextDecoder(); // Reuse decoder instance

    super({
      transform: (chunk, c) => {
        // 1. Simple buffer merge
        const n = new Uint8Array(buffer.length + chunk.length);
        n.set(buffer);
        n.set(chunk, buffer.length);
        buffer = n;

        // 2. Parse in a loop
        // Offset 16 is the length field (fourth I in !IIIII)
        while (buffer.length >= 20) {
          const v = new DataView(buffer.buffer, buffer.byteOffset);
          const len = v.getUint32(16); // DataView is big-endian by default, no flag needed

          if (buffer.length < 20 + len) break; // Wait for a full frame

          // 3. Extract payload and emit
          try {
            c.enqueue(
              JSON.parse(decoder.decode(buffer.subarray(20, 20 + len))),
            );
          } catch (e) {
            c.error(e);
          }

          // 4. Slice consumed bytes
          buffer = buffer.subarray(20 + len);
        }
      },
    });
  }
}

export class MessageToPeertalkTransformStream<TMessage = unknown>
  extends TransformStream<
    TMessage,
    Uint8Array
  >
{
  constructor() {
    const encoder = new TextEncoder(); // Reuse encoder instance

    super({
      transform(chunk, controller) {
        // 1. Encode message body (UTF-8)
        // chunk is a single message; trim here if your messages can contain newlines
        const body = encoder.encode(JSON.stringify(chunk));
        const len = body.length;

        // 2. Allocate buffer (20-byte header + body length)
        const data = new Uint8Array(20 + len);
        const view = new DataView(data.buffer);

        // 3. Write header (DataView is big-endian by default)
        // Layout: [1, 101, 0, len + 4, len]
        view.setUint32(0, 1); // Version
        view.setUint32(4, 101); // Type
        view.setUint32(8, 0); // Tag
        view.setUint32(12, len + 4); // Total Length (Reference logic)
        view.setUint32(16, len); // Payload Length

        // 4. Write message body
        data.set(body, 20);

        // 5. Push downstream
        controller.enqueue(data);
      },
    });
  }
}
