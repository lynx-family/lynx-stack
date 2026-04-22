/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { elementTree, withQueue } from './nativeMethod.js';
import { vi } from 'vitest';

export function __injectElementApi(target?: any) {
  if (typeof target === 'undefined') {
    target = globalThis;
  }

  for (
    const k of Object.getOwnPropertyNames(elementTree.constructor.prototype)
  ) {
    if (k.startsWith('__')) {
      // @ts-ignore
      target[k] = withQueue(k, elementTree[k].bind(elementTree));
    }
  }

  target.$kTemplateAssembler = {};

  target.registerDataProcessor = () => {
    console.error('registerDataProcessor is not implemented');
  };

  target.__OnLifecycleEvent = vi.fn();
  target._ReportError = vi.fn();
}
