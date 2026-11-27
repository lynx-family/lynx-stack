// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MethodName, Methods, ResponseMessage } from '../protocol.js';
import { ProtocolException, toProtocolError } from './errors.js';
import { isMethodName, validators } from './validate.js';

/** The implementation of every method, with validated parameters. */
export type Handlers = {
  [M in MethodName]: (
    params: Methods[M]['params'],
  ) => Promise<Methods[M]['result']> | Methods[M]['result'];
};

/**
 * Validates requests and runs them one after another, in the order they
 * arrive, answering each exactly once.
 *
 * A message that is not an object with a numeric `id` cannot be answered and
 * is dropped.
 */
export class RequestRouter {
  readonly #handlers: Handlers;
  #queue: Promise<void> = Promise.resolve();

  constructor(handlers: Handlers) {
    this.#handlers = handlers;
  }

  /**
   * Handles one message from the host. `respond` is called once, after every
   * earlier request has been answered.
   */
  receive(message: unknown, respond: (response: ResponseMessage) => void) {
    if (
      typeof message !== 'object' || message === null
      || typeof (message as { id?: unknown }).id !== 'number'
    ) {
      console.warn('[web-preview-kit] dropped a message without an id');
      return;
    }
    const { id, method, params } = message as {
      id: number;
      method?: unknown;
      params?: unknown;
    };
    const run = async (): Promise<ResponseMessage> => {
      try {
        if (typeof method !== 'string') {
          throw new ProtocolException(
            'INVALID_REQUEST',
            'A request needs a string method.',
          );
        }
        if (!isMethodName(method)) {
          throw new ProtocolException(
            'UNKNOWN_METHOD',
            `There is no method ${JSON.stringify(method)}.`,
          );
        }
        const result = await this.#dispatch(method, params);
        return { id, result };
      } catch (error) {
        return { id, error: toProtocolError(error) };
      }
    };
    this.#queue = this.#queue.then(async () => {
      const response = await run();
      try {
        respond(response);
      } catch (error) {
        console.error('[web-preview-kit] cannot send a response', error);
      }
    });
  }

  #dispatch<M extends MethodName>(
    method: M,
    params: unknown,
  ): Promise<Methods[M]['result']> | Methods[M]['result'] {
    const validate = validators[method] as (
      params: unknown,
    ) => Methods[M]['params'];
    const handler = this.#handlers[method] as (
      params: Methods[M]['params'],
    ) => Promise<Methods[M]['result']> | Methods[M]['result'];
    return handler(validate(params));
  }
}
