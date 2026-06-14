// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { resolveStateField } from '@openuidev/lang-core';
import type { InferStateFieldValue, StateField } from '@openuidev/lang-core';

import { useFormName, useOpenUI } from '../context.jsx';

/**
 * Resolve a named OpenUI state field against form state and reactive bindings.
 */
export function useStateField<T = unknown>(
  name: string,
  value?: T,
): StateField<InferStateFieldValue<T>> {
  const ctx = useOpenUI();
  const formName = useFormName();

  return resolveStateField<InferStateFieldValue<T>>(
    name,
    value,
    ctx.store ?? null,
    ctx.evaluationContext ?? null,
    (fieldName) => ctx.getFieldValue(formName, fieldName),
    (fieldName, nextValue) =>
      ctx.setFieldValue(formName, undefined, fieldName, nextValue),
  );
}
