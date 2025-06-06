// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { removeFunctionWhiteSpace } from '@lynx-js/css-serializer/dist/plugins/removeFunctionWhiteSpace.js';

import { cssChunksToMap } from './cssChunksToMap.js';
import type { CSS } from '../index.js';
import type { EncodeOptions } from '../LynxTemplatePlugin.js';

export async function encodeCSS(
  cssChunks: string[],
  encodeOptions: EncodeOptions,
  plugins: CSS.Plugin[] = [removeFunctionWhiteSpace()],
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  encode: (options: any) => Promise<{
    buffer: Buffer;
  }> = (options) => {
    const buffer = Buffer.from(JSON.stringify(options));
    return Promise.resolve({
      buffer,
    });
  },
): Promise<Buffer> {
  const css = cssChunksToMap(
    cssChunks,
    plugins,
    Boolean(encodeOptions.compilerOptions['enableCSSSelector']),
  );

  const { buffer } = await encode({
    ...encodeOptions,
    css,
  });

  return buffer;
}
