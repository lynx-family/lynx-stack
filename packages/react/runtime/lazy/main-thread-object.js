// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { sExportsReact, target } from './target.js';

const {
  defineMainThreadObjectType: defineMainThreadObjectTypeImpl,
  useMainThreadObject: useMainThreadObjectImpl,
} = Object(target[sExportsReact]);

export function defineMainThreadObjectType(definition) {
  assertMainThreadObjectRuntimeExport(
    defineMainThreadObjectTypeImpl,
    'defineMainThreadObjectType',
  );
  return defineMainThreadObjectTypeImpl(definition);
}

export function useMainThreadObject(objectType, initialValue) {
  assertMainThreadObjectRuntimeExport(
    useMainThreadObjectImpl,
    'useMainThreadObject',
  );
  return useMainThreadObjectImpl(objectType, initialValue);
}

function assertMainThreadObjectRuntimeExport(value, name) {
  if (typeof value !== 'function') {
    throw new Error(
      `This lazy bundle requires ReactLynx runtime export ${name} for MainThreadObject. Upgrade the main template runtime or rebuild the lazy bundle with a compatible @lynx-js/react version.`,
    );
  }
}
