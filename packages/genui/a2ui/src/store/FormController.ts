// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { computed, signal } from '@preact/signals';
import type { Signal } from '@preact/signals';

export interface CheckFailure {
  /** Name of the function call that returned a falsy condition. */
  call: string;
  /** Operator-friendly message attached to the failing check. */
  message: string;
}

export interface CheckOutcome {
  ok: boolean;
  failures: CheckFailure[];
}

export interface FormController {
  /** Reactive view of whether every registered input currently passes. */
  isValid: Signal<boolean>;
  /** Per-input outcomes, keyed by component id. */
  outcomes: ReadonlyMap<string, Signal<CheckOutcome>>;
  /**
   * Register or update an input's outcome. The returned `dispose` removes
   * the input from the form when it unmounts.
   */
  setOutcome(componentId: string, outcome: CheckOutcome): () => void;
}

export function createFormController(): FormController {
  const inputs = new Map<string, Signal<CheckOutcome>>();
  // Tick on add/remove so the membership change is itself a reactive
  // dependency of `isValid` (per-outcome value changes are already reactive
  // because we read `entry.value` inside the computed).
  const membership = signal(0);
  const isValid = computed(() => {
    void membership.value;
    for (const outcome of inputs.values()) {
      if (!outcome.value.ok) return false;
    }
    return true;
  });
  return {
    isValid,
    outcomes: inputs,
    setOutcome(componentId, outcome) {
      let entry = inputs.get(componentId);
      if (entry) {
        entry.value = outcome;
      } else {
        entry = signal(outcome);
        inputs.set(componentId, entry);
        membership.value++;
      }
      return () => {
        if (inputs.delete(componentId)) {
          membership.value++;
        }
      };
    },
  };
}
