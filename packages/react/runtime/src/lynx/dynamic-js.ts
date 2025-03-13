// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { loadLazyBundle } from './lazy-bundle.js';

export function loadDynamicJS<T>(url: string): Promise<T> {
  if (__LEPUS__) {
    _ReportError(
      new Error(`A dynamic import (to "${url}") is leaked to Lepus bundle.`),
      { errorCode: 202 },
    );
    return Promise.reject();
  }
  return new Promise((resolve, reject) => {
    lynx.requireModuleAsync<T>(url, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data as T);
      }
    });
  });
}

export function __dynamicImport<T>(url: string, options?: any): Promise<T> {
  const t = options?.with?.type;
  if (t === 'component' || t === 'tsx' || t === 'jsx') {
    return loadLazyBundle<any>(url);
  } else {
    return loadDynamicJS(url);
  }
}
