// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createContext } from '@lynx-js/react';

import type { FormController } from '../store/FormController.js';

export type {
  CheckFailure,
  CheckOutcome,
  FormController,
} from '../store/FormController.js';
export { createFormController } from '../store/FormController.js';

/**
 * React context exposing the nearest enclosing form controller, if any.
 * Inputs use it to broadcast their check outcomes; Buttons use it to read
 * `isValid` and disable themselves until every input passes.
 */
export const FormContext: ReturnType<
  typeof createContext<FormController | null>
> = createContext<FormController | null>(null);
