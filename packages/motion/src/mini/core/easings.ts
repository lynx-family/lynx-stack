// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  anticipate as anticipate_,
  backInOut as backInOut_,
  backIn as backIn_,
  backOut as backOut_,
  circInOut as circInOut_,
  circIn as circIn_,
  circOut as circOut_,
  easeInOut as easeInOut_,
  easeIn as easeIn_,
  easeOut as easeOut_,
  noop as linear_,
} from 'motion-utils';

import { registerCallable } from '../../utils/registeredFunction.js';

let anticipateHandle = 'anticipateHandle';
let backInHandle = 'backInHandle';
let backInOutHandle = 'backInOutHandle';
let backOutHandle = 'backOutHandle';
let circInHandle = 'circInHandle';
let circInOutHandle = 'circInOutHandle';
let circOutHandle = 'circOutHandle';
let easeInHandle = 'easeInHandle';
let easeInOutHandle = 'easeInOutHandle';
let easeOutHandle = 'easeOutHandle';
let linearHandle = 'linearHandle';

if (__MAIN_THREAD__) {
  anticipateHandle = registerCallable(anticipate_, 'anticipateHandle');
  backInHandle = registerCallable(backIn_, 'backInHandle');
  backInOutHandle = registerCallable(backInOut_, 'backInOutHandle');
  backOutHandle = registerCallable(backOut_, 'backOutHandle');
  circInHandle = registerCallable(circIn_, 'circInHandle');
  circInOutHandle = registerCallable(circInOut_, 'circInOutHandle');
  circOutHandle = registerCallable(circOut_, 'circOutHandle');
  easeInHandle = registerCallable(easeIn_, 'easeInHandle');
  easeInOutHandle = registerCallable(easeInOut_, 'easeInOutHandle');
  easeOutHandle = registerCallable(easeOut_, 'easeOutHandle');
  linearHandle = registerCallable(linear_, 'linearHandle');
}

export function anticipate(t: number): number {
  'main thread';
  return globalThis.runOnRegistered<typeof anticipate_>(anticipateHandle)(t);
}

export function backIn(t: number): number {
  'main thread';
  return globalThis.runOnRegistered<typeof backIn_>(backInHandle)(t);
}

export function backInOut(t: number): number {
  'main thread';
  return globalThis.runOnRegistered<typeof backInOut_>(backInOutHandle)(t);
}

export function backOut(t: number): number {
  'main thread';
  return globalThis.runOnRegistered<typeof backOut_>(backOutHandle)(t);
}

export function circIn(t: number): number {
  'main thread';
  return globalThis.runOnRegistered<typeof circIn_>(circInHandle)(t);
}

export function circInOut(t: number): number {
  'main thread';
  return globalThis.runOnRegistered<typeof circInOut_>(circInOutHandle)(t);
}

export function circOut(t: number): number {
  'main thread';
  return globalThis.runOnRegistered<typeof circOut_>(circOutHandle)(t);
}

export function easeIn(t: number): number {
  'main thread';
  return globalThis.runOnRegistered<typeof easeIn_>(easeInHandle)(t);
}

export function easeInOut(t: number): number {
  'main thread';
  return globalThis.runOnRegistered<typeof easeInOut_>(easeInOutHandle)(t);
}

export function easeOut(t: number): number {
  'main thread';
  return globalThis.runOnRegistered<typeof easeOut_>(easeOutHandle)(t);
}

export function linear(t: number): number {
  'main thread';
  return globalThis.runOnRegistered<typeof linear_>(linearHandle)(t);
}
