// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { TransformStream } from 'node:stream/web';

export class FilterTransformStream<T, P extends T>
  extends TransformStream<T, P>
{
  constructor(filter: (chunk: T) => chunk is P) {
    super({
      transform(chunk, controller) {
        if (filter(chunk)) {
          controller.enqueue(chunk);
        }
      },
    });
  }
}

export class InspectStream<T> extends TransformStream<T, T> {
  constructor(callback: (message: T) => void) {
    super({
      transform(chunk, controller) {
        callback(chunk);
        controller.enqueue(chunk);
      },
    });
  }
}
