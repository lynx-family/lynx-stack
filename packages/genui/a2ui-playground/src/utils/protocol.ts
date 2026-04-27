// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export type ProtocolVersion = '0.9';

export const DEFAULT_PROTOCOL: ProtocolVersion = '0.9';

export function normalizeProtocol(
  _value: string | null | undefined,
): ProtocolVersion {
  return '0.9';
}
