// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { effect } from '@preact/signals';

import { useContext, useEffect, useState } from '@lynx-js/react';

import { FormContext } from './FormContext.js';
import { useA2UIContext } from './useA2UIContext.js';
import type { CheckFailure, CheckOutcome } from '../store/FormController.js';
import type { MessageProcessor } from '../store/MessageProcessor.js';
import {
  executeFunctionCall,
  isDataBinding,
  isFunctionCall,
  resolveDynamicValue,
} from '../store/resolveFunctionCall.js';
import type { Surface } from '../store/types.js';

/**
 * A v0.9 `CheckRule` is `{ condition, message }` where `condition` is a
 * boolean, a `DataBinding`, or a `FunctionCall`. We accept the loose
 * `unknown` shape so component props don't have to import the v0_9
 * types just to pass them through.
 */
export interface CheckLike {
  condition: unknown;
  message: string;
}

function evaluateCondition(
  processor: MessageProcessor,
  condition: unknown,
  surfaceId: string,
  dataContextPath?: string,
): boolean {
  if (typeof condition === 'boolean') return condition;
  if (isFunctionCall(condition)) {
    const result = executeFunctionCall(
      processor,
      condition,
      surfaceId,
      dataContextPath,
    );
    return Boolean(result);
  }
  if (isDataBinding(condition)) {
    return Boolean(
      resolveDynamicValue(processor, condition, surfaceId, dataContextPath),
    );
  }
  // Unknown shape — treat as passing rather than blocking the user.
  return true;
}

function evaluateChecks(
  processor: MessageProcessor,
  checks: CheckLike[] | undefined,
  surface: Surface | undefined,
  dataContextPath?: string,
): CheckOutcome {
  if (!surface || !Array.isArray(checks) || checks.length === 0) {
    return { ok: true, failures: [] };
  }
  const failures: CheckFailure[] = [];
  for (const rule of checks) {
    const ok = evaluateCondition(
      processor,
      rule.condition,
      surface.surfaceId,
      dataContextPath,
    );
    if (!ok) {
      failures.push({
        call: isFunctionCall(rule.condition)
          ? rule.condition.call
          : 'condition',
        message: rule.message,
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
  const { processor } = useA2UIContext();
  const form = useContext(FormContext);

  const [outcome, setOutcome] = useState<CheckOutcome>(() =>
    evaluateChecks(processor, checks, surface, dataContextPath)
  );

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- `useEffect` is correctly typed; ESLint's project graph can't resolve it through the workspace `@lynx-js/react` symlink (same pattern as `useDataBinding.ts`).
  useEffect(() => {
    if (!surface) {
      setOutcome({ ok: true, failures: [] });
      return;
    }
    const dispose = effect(() => {
      const next = evaluateChecks(processor, checks, surface, dataContextPath);
      setOutcome(next);
    });
    return dispose;
  }, [processor, checks, surface, dataContextPath]);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- see comment above on the preceding `useEffect` call.
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
