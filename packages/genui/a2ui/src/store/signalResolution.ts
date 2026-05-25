// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { computed, signal } from '@preact/signals';
import type { Signal } from '@preact/signals';

import type { MessageProcessor } from './MessageProcessor.js';
import {
  createResolveFunctionCall,
  resolveDeepValue,
  resolveDynamicValue,
} from './resolveDynamic.js';
import type { ResolveDynamicValueOptions } from './resolveDynamic.js';
import { isDataBinding, isFunctionCall } from './utils.js';

function signalFromStore(
  processor: MessageProcessor,
  path: string,
  surfaceId: string,
  dataContextPath?: string,
): Signal<unknown> {
  const surface = processor.getOrCreateSurface(surfaceId);
  const resolvedPath = processor.resolvePath(path, dataContextPath);
  return surface.store.getSignal(resolvedPath);
}

export function createResolvedSignal(
  processor: MessageProcessor,
  value: unknown,
  surfaceId: string,
  dataContextPath: string | undefined,
  options: ResolveDynamicValueOptions,
): Signal<unknown> {
  const resolveFunctionCall = createResolveFunctionCall(options);

  if (isDataBinding(value)) {
    return signalFromStore(processor, value.path, surfaceId, dataContextPath);
  }
  if (isFunctionCall(value)) {
    return computed(() =>
      resolveFunctionCall?.(
        processor,
        value,
        surfaceId,
        dataContextPath,
      )
    );
  }
  if (Array.isArray(value)) {
    return computed(() =>
      resolveDeepValue(
        value,
        undefined,
        (leaf) =>
          resolveDynamicValue(
            processor,
            leaf,
            surfaceId,
            dataContextPath,
            options,
          ),
      )
    );
  }
  return signal(value);
}
