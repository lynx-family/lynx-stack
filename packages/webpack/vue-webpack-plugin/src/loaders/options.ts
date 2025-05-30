// options.ts
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0

import type { LoaderContext } from '@rspack/core';

export interface VueLoaderOptions {
  isProduction?: boolean;
  enableCssModules?: boolean;
  enableSourceMap?: boolean;
  exposeFilename?: boolean;
  customBlocks?: string[];
}

export function getMainThreadTransformOptions(this: LoaderContext<VueLoaderOptions>) {
  const options = this.getOptions();
  return {
    isProduction: options.isProduction ?? this.mode === 'production',
    enableSourceMap: options.enableSourceMap ?? this.sourceMap,
    exposeFilename: options.exposeFilename ?? false,
    compileTemplate: true,
    targetLayer: 'main',
    customBlocks: options.customBlocks ?? [],
  };
}

export function getBackgroundTransformOptions(this: LoaderContext<VueLoaderOptions>) {
  const options = this.getOptions();
  return {
    isProduction: options.isProduction ?? this.mode === 'production',
    enableSourceMap: options.enableSourceMap ?? this.sourceMap,
    exposeFilename: options.exposeFilename ?? false,
    compileTemplate: false,
    targetLayer: 'background',
    customBlocks: options.customBlocks ?? [],
  };
}

export function getCssModuleConfig(enableCssModules: boolean) {
  return {
    modules: {
      localIdentName: enableCssModules 
        ? '[local]_[hash:base64:5]' 
        : '[local]',
    },
  };
}
