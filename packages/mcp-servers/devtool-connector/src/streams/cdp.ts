// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { randomInt } from 'node:crypto';

import type { CDPRequestMessage, CDPResponseMessage } from '../types.ts';
import {
  CustomizedRequestTransformStream,
  CustomizedResponseTransformStream,
  ResponseParserTransformStream,
} from './customized.ts';

export class CDPRequestTransformStream extends CustomizedRequestTransformStream<
  CDPRequestMessage & { sessionId: number }
> {
  constructor(port: number, fixedId?: number) {
    super({
      type: 'CDP',
      port,
      sessionId: (chunk) => chunk.sessionId,
      messageBuilder: (chunk) => {
        const id = fixedId ?? randomInt(10_000, 50_000);
        const { method, params } = chunk;
        return { id, method, params };
      },
    });
  }
}

export class CDPResponseTransformStream<Output = CDPResponseMessage>
  extends CustomizedResponseTransformStream<'CDP', Output>
{
  constructor(id?: number) {
    super('CDP', id);
  }
}

export class CDPOutputTransformStream<Output>
  extends ResponseParserTransformStream<CDPResponseMessage, Output>
{
  constructor() {
    super({
      checkError: (message) => {
        if ('error' in message) {
          return new Error(
            `CDP request error: ${message.error.message}`,
            { cause: message },
          );
        }
        return null;
      },
      parseResult: (message) => {
        if ('result' in message) {
          return message.result as Output;
        }
        throw new Error('No result in CDP response message', {
          cause: message,
        });
      },
    });
  }
}
