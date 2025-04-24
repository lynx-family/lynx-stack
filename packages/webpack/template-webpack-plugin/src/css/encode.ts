// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { removeFunctionWhiteSpace } from '@lynx-js/css-serializer/dist/plugins/removeFunctionWhiteSpace.js';

import { cssChunksToMap } from './cssChunksToMap.js';
import type { CSS } from '../index.js';

/**
 * The options for encoding CSS.
 *
 * @public
 */
export interface EncodeCSSOptions {
  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.enableCSSSelector}
   */
  enableCSSSelector: boolean;

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.enableRemoveCSSScope}
   */
  enableRemoveCSSScope: boolean;

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.enableCSSInvalidation}
   */
  enableCSSInvalidation: boolean;

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.enableRemoveCSSScope}
   */
  targetSdkVersion: string;
}

export async function encodeCSS(
  cssChunks: string[],
  {
    enableCSSSelector,
    enableRemoveCSSScope,
    enableCSSInvalidation,
    targetSdkVersion,
  }: EncodeCSSOptions,
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
  const css = cssChunksToMap(cssChunks, plugins, enableCSSSelector);

  const encodeOptions = {
    compilerOptions: {
      // Do not remove this, it will crash :)
      enableFiberArch: true,
      useLepusNG: true,
      bundleModuleMode: 'ReturnByFunction',

      enableCSSSelector,
      enableCSSInvalidation,
      targetSdkVersion,
    },
    sourceContent: {
      appType: 'card',
      config: {
        lepusStrict: true,

        enableRemoveCSSScope,
      },
    },
    css,
  };

  const { buffer } = await encode(encodeOptions);

  return buffer;
}
