import { generateRegister } from './generateRegister.js';

/**
// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
export type EventStatusChangeHandler = (
  enable: boolean,
  eventName: string,
) => void;
/**
 * @param eventName
 * @returns
 */
export const registerEventEnableStatusChangeHandler = generateRegister<
  [],
  EventStatusChangeHandler,
  EventStatusChangeHandler,
  'eventStatusChangedHandler'
>(
  'eventStatusChangedHandler' as const,
  (handler) => handler,
);
