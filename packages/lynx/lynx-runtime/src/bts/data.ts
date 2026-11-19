// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { subscribeBTSSlot } from './scope.js';
import type { BTSPageScope } from './scope.js';
import type {
  BTSReloadOptions,
  BTSUpdateOptions,
  Unsubscribe,
} from '../common/types.js';

/** @internal */
export function scopeOnGlobalPropsChanged<T = Record<string, unknown>>(
  scope: BTSPageScope,
  listener: (globalProps: Readonly<T>) => void,
): Unsubscribe {
  return subscribeBTSSlot<[Record<string, unknown> | undefined]>(
    scope,
    'updateGlobalProps',
    () => {
      listener(scope.globalProps as Readonly<T>);
    },
    listener,
  );
}

/** @internal */
export function scopeOnUpdateData<T = Record<string, unknown>>(
  scope: BTSPageScope,
  listener: (data: Readonly<T>, options: Readonly<BTSUpdateOptions>) => void,
): Unsubscribe {
  return subscribeBTSSlot<
    [
      Record<string, unknown> | undefined,
      | { type?: number | undefined; processorName?: string | undefined }
      | undefined,
    ]
  >(
    scope,
    'updateCardData',
    (data, rawOptions) => {
      listener((data ?? {}) as Readonly<T>, {
        resetPageData: rawOptions?.type === 1,
        processorName: rawOptions?.processorName === ''
          ? undefined
          : rawOptions?.processorName,
      });
    },
    listener,
  );
}

/** @internal */
export function scopeOnReload<T = Record<string, unknown>>(
  scope: BTSPageScope,
  listener: (data: Readonly<T>, options: Readonly<BTSReloadOptions>) => void,
): Unsubscribe {
  return subscribeBTSSlot<
    [Record<string, unknown> | undefined, BTSReloadOptions | undefined]
  >(
    scope,
    'onAppReload',
    (data, options) => {
      listener(
        (data ?? {}) as Readonly<T>,
        options
          ? {
            ...options,
            processorName: options.processorName === ''
              ? undefined
              : options.processorName,
          }
          : {},
      );
    },
    listener,
  );
}

/** @internal */
export function scopeOnConfigChanged<T = Record<string, unknown>>(
  scope: BTSPageScope,
  listener: (config: Readonly<T>) => void,
): Unsubscribe {
  return subscribeBTSSlot<[Record<string, unknown> | undefined]>(
    scope,
    'processCardConfig',
    (config) => {
      listener((config ?? {}) as Readonly<T>);
    },
    listener,
  );
}
