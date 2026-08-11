// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { WorkletEvents } from '@lynx-js/react/worklet-runtime/bindings';

import { addWorkletRefInitValue } from './workletRefPool.js';
import { allocateWorkletValueId } from './workletValueId.js';

type WorkletValueKind =
  | { readonly kind: 'mutable-cell' }
  | {
    readonly kind: 'typed-object';
    readonly type: string;
    readonly protocolVersion: number;
  };

/**
 * Allocate and publish the source-runtime half of a worklet value handle.
 *
 * MainThreadRef and MainThreadObject deliberately share this transport
 * lifecycle. Their target realization remains different: an untyped handle
 * becomes a MutableCell, while a typed handle uses its registered factory.
 *
 * @internal
 */
export function createWorkletValueHandleState<I>(
  initialValue: I,
  valueKind: WorkletValueKind,
) {
  const id = allocateWorkletValueId();
  const isTypedObject = valueKind.kind === 'typed-object';
  const type = isTypedObject ? valueKind.type : 'main-thread';
  const protocolVersion = isTypedObject
    ? valueKind.protocolVersion
    : undefined;

  let lifecycleObserver: unknown;
  if (__JS__) {
    addWorkletRefInitValue(
      id,
      initialValue,
      isTypedObject ? type : undefined,
      protocolVersion,
    );
    lifecycleObserver = lynx.getNativeApp().createJSObjectDestructionObserver?.(() => {
      lynx.getCoreContext?.().dispatchEvent({
        type: WorkletEvents.releaseWorkletRef,
        data: { id },
      });
    });
  }

  return { id, initialValue, type, protocolVersion, lifecycleObserver };
}
