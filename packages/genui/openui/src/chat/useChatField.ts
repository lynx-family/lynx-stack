// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  isReactiveAssign,
  parseStructuredRules,
  resolveStateField,
} from '@openuidev/lang-core';
import type { StateField } from '@openuidev/lang-core';

import { useEffect, useMemo, useRef, useState } from '@lynx-js/react';

import { useFormName, useIsStreaming, useOpenUI } from '../core/context.jsx';
import { useFormValidation } from '../core/hooks/useFormValidation.js';
import { useStateField } from '../core/hooks/useStateField.js';

let nextValidationId = 0;

/** Keep controls, defaults and validation on the response store, not component-local drafts. */
export function useChatField<T>(
  name: string,
  binding: unknown,
  defaultValue: T,
  rulesInput: unknown,
  normalize: (value: T) => unknown = value => value,
) {
  const ctx = useOpenUI();
  const form = useFormName();
  const streaming = useIsStreaming();
  const field = useStateField(name, binding as StateField<T | undefined>);
  // Controls can mount before the renderer's store-initialization effect.
  // Declaration and hydration fallbacks must win over a control's empty default.
  const bindingDefault = isReactiveAssign(binding)
    ? ctx.evaluationContext?.getState(binding.target) as T | undefined
    : undefined;
  const validation = useFormValidation();
  const [controlId] = useState(() => ++nextValidationId);
  const validationName = `${name}:${controlId}`;
  const rules = useMemo(() => parseStructuredRules(rulesInput), [rulesInput]);
  // Resolve again inside events/effects: another control may have changed a shared
  // binding since this render, before React flushes the next render.
  const current = () =>
    resolveStateField<T | undefined>(
      name,
      binding,
      ctx.store,
      ctx.evaluationContext,
      key => ctx.getFieldValue(form, key),
      (key, value) => ctx.setFieldValue(form, undefined, key, value),
    );
  const read = () => current().value ?? bindingDefault ?? defaultValue;
  const readRef = useRef(read);
  readRef.current = read;
  const normalizeRef = useRef(normalize);
  normalizeRef.current = normalize;
  const register = validation?.registerField;
  const unregister = validation?.unregisterField;
  useEffect(() => {
    if (!streaming && register && rules.length) {
      register(
        validationName,
        rules,
        () => normalizeRef.current(readRef.current()),
      );
      return () => unregister?.(validationName);
    }
    return undefined;
  }, [validationName, streaming, rules, register, unregister]);
  useEffect(() => {
    const latest = current();
    if (
      !streaming && latest.value === undefined && bindingDefault === undefined
      && defaultValue !== undefined
    ) latest.setValue(defaultValue);
  });
  return {
    value: field.value ?? bindingDefault ?? defaultValue,
    read,
    streaming,
    error: validation?.getFieldError(validationName),
    clearError: () => validation?.clearFieldError(validationName),
    validate: (value: T) =>
      validation?.validateField(validationName, normalize(value), rules),
    set: (value: T) => {
      if (!streaming) current().setValue(value);
    },
    update: (updater: (previous: T) => T) => {
      if (!streaming) current().setValue(updater(read()));
    },
  };
}
