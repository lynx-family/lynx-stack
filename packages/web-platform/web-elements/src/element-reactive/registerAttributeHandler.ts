import { generateRegister } from './generateRegister.js';

/**
// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
export type AttributeChangeHandler = (
  newValue: string | null,
  oldValue: string | null,
  attributeName: string,
) => void;

/**
 * @param attributeName
 * @param noDomMeasure  If there are any measurement operation, the handler will be invoked after connected
 * @returns
 */
export const registerAttributeHandler = generateRegister<
  [boolean],
  { handler: AttributeChangeHandler; noDomMeasure: boolean },
  AttributeChangeHandler,
  'attributeChangedHandler'
>(
  'attributeChangedHandler',
  (handler, [noDomMeasure]) => ({
    handler,
    noDomMeasure,
  }),
);
