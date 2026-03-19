// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { TransformStream } from 'node:stream/web';

import { isCustomizedResponseWithType } from '../types.ts';
import type {
  AppResponseMessage,
  CustomizedResponseMap,
  CustomizedResponseMessageMap,
  Response,
} from '../types.ts';

export class CustomizedRequestTransformStream<T = unknown>
  extends TransformStream<T, unknown>
{
  protected port: number;

  constructor(options: {
    type: string;
    port: number;
    sessionId?: number | ((chunk: T) => number);
    messageBuilder: (chunk: T) => unknown;
  }) {
    const { type, port, sessionId = -1, messageBuilder } = options;
    super({
      transform(chunk, controller) {
        const sid = typeof sessionId === 'function'
          ? sessionId(chunk)
          : sessionId;
        controller.enqueue({
          event: 'Customized',
          data: {
            type,
            data: {
              client_id: port,
              session_id: sid,
              message: messageBuilder(chunk),
            },
            sender: port,
          },
        });
      },
    });
    this.port = port;
  }
}

export class CustomizedResponseTransformStream<
  T extends keyof CustomizedResponseMap,
  Output = CustomizedResponseMessageMap[T],
> extends TransformStream<Response, Output> {
  constructor(type: T, id?: number) {
    super({
      transform(response, controller) {
        if (!isCustomizedResponseWithType(response, type)) {
          return;
        }

        try {
          const message = JSON.parse(response.data.data.message) as Output & {
            id?: number;
          };
          if (id === undefined || message?.id === id) {
            controller.enqueue(message);
          }
        } catch (err) {
          controller.error(
            new Error(`Failed to parse response for type ${type}`, {
              cause: err,
            }),
          );
        }
      },
    });
  }
}

/**
 * Common response parser that handles JSON parsing and error checking in the payload.
 */
export class ResponseParserTransformStream<Input, Output>
  extends TransformStream<Input, Output>
{
  constructor(options: {
    parseResult: (input: Input) => Output;
    checkError: (input: Input) => Error | null;
  }) {
    const { parseResult, checkError } = options;
    super({
      transform(chunk, controller) {
        const error = checkError(chunk);
        if (error) {
          controller.error(error);
          return;
        }

        try {
          controller.enqueue(parseResult(chunk));
        } catch (err) {
          controller.error(err);
        }
      },
    });
  }
}

export class AppResponseTransformStream<Output>
  extends ResponseParserTransformStream<AppResponseMessage, Output>
{
  constructor(method: string) {
    super({
      checkError: (message) => {
        try {
          const result = JSON.parse(message.result) as {
            code: number | string;
            message: string;
          };
          if (
            /** Android */ result.code !== 0 && /** iOS */ result.code !== '0'
          ) {
            return new Error(`App request ${method} error: ${result.message}`, {
              cause: message,
            });
          }
          return null;
        } catch (err) {
          return new Error('Failed to parse App response message', {
            cause: err,
          });
        }
      },
      parseResult: (message) => {
        return JSON.parse(message.result) as Output;
      },
    });
  }
}

export class GlobalSwitchRequestTransformStream
  extends CustomizedRequestTransformStream<{
    key: string;
    value?: boolean;
  }>
{
  constructor(type: 'SetGlobalSwitch' | 'GetGlobalSwitch', port: number) {
    super({
      type,
      port,
      sessionId: -1,
      messageBuilder: ({ key, value }) => ({
        global_key: key,
        global_value: value,
      }),
    });
  }
}
