// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Shared wire contract for source handles, backend transports, and the MTS runtime.
export const MAIN_THREAD_OBJECT_PROTOCOL_VERSION = 1;

export type MainThreadRefInitValuePatch = (
  | [id: number, value: unknown]
  | [id: number, value: unknown, type: string, mainThreadObjectProtocolVersion: number]
)[];
