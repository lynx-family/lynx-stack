// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ErrorCode, ProtocolError } from '../protocol.js';

/** An error that becomes the `ProtocolError` of a response. */
export class ProtocolException extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'ProtocolException';
    this.code = code;
  }
}

/** Turns anything thrown by a handler into a `ProtocolError`. */
export function toProtocolError(error: unknown): ProtocolError {
  if (error instanceof ProtocolException) {
    return { code: error.code, message: error.message };
  }
  return {
    code: 'INTERNAL',
    message: error instanceof Error ? error.message : String(error),
  };
}
