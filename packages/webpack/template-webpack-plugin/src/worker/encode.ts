// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { EncodeResult } from '@lynx-js/tasm';

export interface EncodeWorkerOptions {
  encodeBinary?: string | undefined;
  encodeOptions: unknown;
  tasmPkg?: string;
}

export default async function encode(
  {
    encodeBinary = undefined,
    encodeOptions,
    tasmPkg = '@lynx-js/tasm',
  }: EncodeWorkerOptions,
): Promise<EncodeResult> {
  const { getEncodeMode } =
    (await import(tasmPkg)) as typeof import('@lynx-js/tasm');
  // Napi will be used if supported
  const encode = getEncodeMode(encodeBinary) as (
    options: unknown,
  ) => Promise<EncodeResult>;
  return encode(encodeOptions);
}
