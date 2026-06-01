// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { createFormController } from '../src/store/FormController.js';

describe('FormController', () => {
  test('isValid is true when no inputs registered', () => {
    const form = createFormController();
    expect(form.isValid.value).toBe(true);
  });

  test('isValid is false when any input fails', () => {
    const form = createFormController();
    form.setOutcome('input-a', { ok: true, failures: [] });
    form.setOutcome('input-b', {
      ok: false,
      failures: [{ call: 'required', message: 'Required' }],
    });
    expect(form.isValid.value).toBe(false);
  });

  test('isValid flips back to true when failing input is removed', () => {
    const form = createFormController();
    const disposeA = form.setOutcome('input-a', {
      ok: false,
      failures: [{ call: 'required', message: 'Required' }],
    });
    form.setOutcome('input-b', { ok: true, failures: [] });
    expect(form.isValid.value).toBe(false);
    disposeA();
    expect(form.isValid.value).toBe(true);
  });

  test('setOutcome updates existing entries in place', () => {
    const form = createFormController();
    form.setOutcome('input-a', {
      ok: false,
      failures: [{ call: 'required', message: 'Required' }],
    });
    expect(form.isValid.value).toBe(false);
    form.setOutcome('input-a', { ok: true, failures: [] });
    expect(form.isValid.value).toBe(true);
  });
});
