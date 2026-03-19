/**
// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { generateRegister } from './generateRegister.js';
export type StyleChangeHandler = (
  newValue: string | null,
  styleHyphenName: string,
) => void;

export const registerStyleChangeHandler = generateRegister<
  [],
  StyleChangeHandler,
  StyleChangeHandler,
  'cssPropertyChangedHandler'
>(
  'cssPropertyChangedHandler',
  (handler) => handler,
);
