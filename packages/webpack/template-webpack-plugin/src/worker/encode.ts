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
  const tasmEncode = getEncodeMode(encodeBinary);

  if (!isDebug()) {
    return tasmEncode(encodeOptions, false);
  }

  try {
    return await tasmEncode(encodeOptions, true);
  } finally {
    // biome-ignore lint/suspicious/noConsoleLog: This is opt-in encode trace output.
    console.log('[TASM Encode Trace] End!\n');
  }
}

export function isDebug(): boolean {
  if (!process.env['DEBUG']) {
    return false;
  }

  const values = process.env['DEBUG'].toLocaleLowerCase().split(',');
  return [
    'rspeedy:*',
    'rspeedy:template',
  ].some(value => values.includes(value));
}
