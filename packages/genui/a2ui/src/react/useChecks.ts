// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useContext, useEffect, useState } from '@lynx-js/react';
import { effect } from '@lynx-js/react-signals';

import { FormContext } from './FormContext.js';
import { useA2UIContext } from './useA2UIContext.js';
import type { CatalogFunctionEntry } from '../catalog/defineCatalog.js';
import type { CheckFailure, CheckOutcome } from '../store/FormController.js';
import { executeFunctionCall } from '../store/index.js';
import type { MessageProcessor } from '../store/MessageProcessor.js';
import { resolveDynamicValue } from '../store/resolveDynamic.js';
import type { Surface } from '../store/types.js';
import { isDataBinding, isFunctionCall } from '../store/utils.js';

/**
 * A v1.0 `CheckRule` is `{ condition }` where `condition` is a
 * `DataBinding` or a `FunctionCall`. We accept the loose
 * `unknown` shape so component props can pass dynamic checks through.
 */
export interface CheckLike {
  condition: unknown;
}

function evaluateCondition(
  processor: MessageProcessor,
  condition: unknown,
  surfaceId: string,
  dataContextPath?: string,
  functions?: readonly CatalogFunctionEntry[],
): unknown {
  if (isFunctionCall(condition)) {
    const result = executeFunctionCall(
      processor,
      condition,
      surfaceId,
      dataContextPath,
      { functions },
    );
    return result;
  }
  if (isDataBinding(condition)) {
    return resolveDynamicValue(
      processor,
      condition,
      surfaceId,
      dataContextPath,
      {
        functions,
        resolveFunctionCall: executeFunctionCall,
      },
    );
  }
  return undefined;
}

/** Evaluate structured ValidationResult values. @internal */
export function evaluateChecks(
  processor: MessageProcessor,
  checks: CheckLike[] | undefined,
  surface: Surface | undefined,
  dataContextPath?: string,
  functions?: readonly CatalogFunctionEntry[],
): CheckOutcome {
  if (!surface || !Array.isArray(checks) || checks.length === 0) {
    return { ok: true, failures: [] };
  }
  const failures: CheckFailure[] = [];
  for (const rule of checks) {
    const result = evaluateCondition(
      processor,
      rule.condition,
      surface.surfaceId,
      dataContextPath,
      functions,
    );
    const validation = result && typeof result === 'object' && 'valid' in result
      ? result as { valid: boolean; message?: string }
      : undefined;
    const ok = validation?.valid === true;
    if (!ok) {
      failures.push({
        call: isFunctionCall(rule.condition)
          ? rule.condition.call
          : 'condition',
        message: typeof validation?.message === 'string'
          ? validation.message
          : 'Validation failed',
      });
    }
  }
  return { ok: failures.length === 0, failures };
}

/**
 * Evaluate an input component's `checks` array reactively. Returns the
 * current outcome plus the first failure message (handy for inline error
 * rendering). When an enclosing `<FormContext.Provider>` exists, the input
 * is also registered with it so Buttons in the same form can react to
 * `isValid`.
 */
export function useChecks(
  options: {
    checks: CheckLike[] | undefined;
    componentId: string;
    surface: Surface | undefined;
    dataContextPath?: string | undefined;
  },
): CheckOutcome & { firstFailureMessage: string | undefined } {
  const { checks, componentId, surface, dataContextPath } = options;
  const { catalog, processor } = useA2UIContext();
  const form = useContext(FormContext);

  const [outcome, setOutcome] = useState<CheckOutcome>(() =>
    evaluateChecks(
      processor,
      checks,
      surface,
      dataContextPath,
      catalog.functions,
    )
  );

  useEffect(() => {
    if (!surface) {
      setOutcome({ ok: true, failures: [] });
      return;
    }
    const dispose = effect(() => {
      const next = evaluateChecks(
        processor,
        checks,
        surface,
        dataContextPath,
        catalog.functions,
      );
      setOutcome(next);
    });
    return dispose;
  }, [processor, checks, surface, dataContextPath, catalog.functions]);

  useEffect(() => {
    // Skip registration when no componentId is available — otherwise every
    // unnamed input collides under the same '' key in the form controller.
    if (!form || !componentId) return;
    return form.setOutcome(componentId, outcome);
  }, [form, componentId, outcome]);

  return {
    ok: outcome.ok,
    failures: outcome.failures,
    firstFailureMessage: outcome.failures[0]?.message,
  };
}
