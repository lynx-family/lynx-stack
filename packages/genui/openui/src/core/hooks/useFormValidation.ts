// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { validate } from '@openuidev/lang-core';
import type { ParsedRule } from '@openuidev/lang-core';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from '@lynx-js/react';

/**
 * Validation state and helpers for OpenUI form fields.
 */
export interface FormValidationContextValue {
  errors: Record<string, string | undefined>;
  getFieldError: (name: string) => string | undefined;
  validateField: (name: string, value: unknown, rules: ParsedRule[]) => boolean;
  registerField: (
    name: string,
    rules: ParsedRule[],
    getValue: () => unknown,
  ) => void;
  unregisterField: (name: string) => void;
  validateForm: () => boolean;
  clearFieldError: (name: string) => void;
}

export const FormValidationContext = createContext<
  FormValidationContextValue | null
>(null);

/**
 * Read the nearest OpenUI form validation context, if one exists.
 */
export function useFormValidation(): FormValidationContextValue | null {
  return useContext(FormValidationContext);
}

interface FieldRegistration {
  rules: ParsedRule[];
  getValue: () => unknown;
}

/**
 * Create form validation state and callbacks for an OpenUI form boundary.
 */
export function useCreateFormValidation(): FormValidationContextValue {
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const errorsRef = useRef(errors);
  errorsRef.current = errors;
  const fieldsRef = useRef<Record<string, FieldRegistration>>({});

  const getFieldError = useCallback(
    (name: string) => errorsRef.current[name],
    [],
  );

  const validateField = useCallback(
    (name: string, value: unknown, rules: ParsedRule[]): boolean => {
      const error = validate(value, rules);
      setErrors((prev) => {
        if (prev[name] === error) return prev;
        return { ...prev, [name]: error };
      });
      return !error;
    },
    [],
  );

  const registerField = useCallback(
    (name: string, rules: ParsedRule[], getValue: () => unknown) => {
      fieldsRef.current[name] = { rules, getValue };
    },
    [],
  );

  const unregisterField = useCallback((name: string) => {
    delete fieldsRef.current[name];
  }, []);

  const validateForm = useCallback((): boolean => {
    let allValid = true;
    const newErrors: Record<string, string | undefined> = {};

    for (const [name, reg] of Object.entries(fieldsRef.current)) {
      let value = reg.getValue();
      // Normalize: form state stores { value, componentType }; extract actual value if needed
      if (
        value != null
        && typeof value === 'object'
        && 'value' in value
        && 'componentType' in value
      ) {
        value = (value as { value: unknown }).value;
      }
      const error = validate(value, reg.rules);
      newErrors[name] = error;
      if (error) allValid = false;
    }

    setErrors(newErrors);
    return allValid;
  }, []);

  const clearFieldError = useCallback((name: string) => {
    setErrors((prev) => {
      if (prev[name] === undefined) return prev;
      return { ...prev, [name]: undefined };
    });
  }, []);

  return useMemo<FormValidationContextValue>(
    () => ({
      errors,
      getFieldError,
      validateField,
      registerField,
      unregisterField,
      validateForm,
      clearFieldError,
    }),
    [
      errors,
      getFieldError,
      validateField,
      registerField,
      unregisterField,
      validateForm,
      clearFieldError,
    ],
  );
}
