// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Handles JSX spread operator in the snapshot system.
 *
 * Spread operators in JSX (e.g., <div {...props}>) are transformed into
 * optimized attribute updates at compile time, avoiding runtime object spreads.
 */

import { BackgroundSnapshotInstance } from '../backgroundSnapshot.js';
import { __pendingListUpdates, ListUpdateInfoRecording } from '../list.js';
import { SnapshotInstance } from '../snapshot.js';
import { isDirectOrDeepEqual, isEmptyObject, pick } from '../utils.js';
import { updateEvent } from './event.js';
import { updateGesture } from './gesture.js';
import { platformInfoAttributes, updateListItemPlatformInfo } from './platformInfo.js';
import { transformRef, updateRef } from './ref.js';
import { updateWorkletEvent } from './workletEvent.js';
import { updateWorkletRef } from './workletRef.js';

const eventRegExp = /^(([A-Za-z-]*):)?(bind|catch|capture-bind|capture-catch|global-bind)([A-Za-z]+)$/;
const eventTypeMap: Record<string, string> = {
  bind: 'bindEvent',
  catch: 'catchEvent',
  'capture-bind': 'capture-bind',
  'capture-catch': 'capture-catch',
  'global-bind': 'global-bindEvent',
};
const noFlattenAttributes = /* @__PURE__ */ new Set<string>([
  'name',
  'clip-radius',
  'overlap',
  'exposure-scene',
  'exposure-id',
]);

function updateSpread(snapshot: SnapshotInstance, index: number, oldValue: any, elementIndex: number): void {
  oldValue ||= {};
  let newValue: Record<string, any> = snapshot.__values![index]; // compiler guarantee this must be an object;

  // @ts-ignore
  const list = snapshot.__parent;
  if (list?.__snapshot_def.isListHolder) {
    const oldPlatformInfo = pick(oldValue, platformInfoAttributes);
    const platformInfo = pick(newValue, platformInfoAttributes);
    if (!isDirectOrDeepEqual(oldPlatformInfo, platformInfo)) {
      (__pendingListUpdates.values[list.__id] ??= new ListUpdateInfoRecording(list)).onSetAttribute(
        snapshot,
        platformInfo,
        oldPlatformInfo,
      );
      snapshot.__listItemPlatformInfo = platformInfo;

      // The fakeSnapshot is missing `__parent`, so no `ListUpdateInfoRecording#onSetAttribute` will be called
      const fakeSnapshot = {
        __values: {
          get [index]() {
            return platformInfo;
          },
        },
        __id: snapshot.__id,
        __elements: snapshot.__elements,
      } as SnapshotInstance;
      updateListItemPlatformInfo(fakeSnapshot, index, oldPlatformInfo, elementIndex);
    }
  }

  if (!snapshot.__elements) {
    return;
  }

  if ('__spread' in newValue) {
    // first screen
    newValue = transformSpread(snapshot, index, newValue);
    snapshot.__values![index] = newValue;
  }

  const dataset: Record<string, any> = {};
  let match: RegExpMatchArray | null = null;
  for (const key in newValue) {
    const v = newValue[key];
    if (v !== oldValue[key]) {
      if (key === 'className') {
        __SetClasses(snapshot.__elements[elementIndex]!, v);
      } else if (key === 'style') {
        __SetInlineStyles(snapshot.__elements[elementIndex]!, v);
      } else if (key === 'id') {
        __SetID(snapshot.__elements[elementIndex]!, v);
      } else if (key.startsWith('data-')) {
        // collected below
      } else if (key === 'ref') {
        snapshot.__ref_set ??= new Set();
        const fakeSnapshot = {
          __values: {
            get [index]() {
              return v;
            },
            set [index](value: unknown) {
              // Modifications to the ref value should be reflected in the corresponding position of the spread.
              newValue[key] = value;
            },
          },
          __id: snapshot.__id,
          __elements: snapshot.__elements,
          __ref_set: snapshot.__ref_set,
        } as SnapshotInstance;
        updateRef(fakeSnapshot, index, oldValue[key], elementIndex, key);
      } else if (key.endsWith(':ref')) {
        snapshot.__worklet_ref_set ??= new Set();
        const fakeSnapshot = {
          __values: {
            get [index]() {
              return v;
            },
          },
          __id: snapshot.__id,
          __elements: snapshot.__elements,
          __worklet_ref_set: snapshot.__worklet_ref_set,
        } as SnapshotInstance;
        updateWorkletRef(fakeSnapshot, index, oldValue[key], elementIndex, key.slice(0, -4));
      } else if (key.endsWith(':gesture')) {
        const workletType = key.slice(0, -8);
        const fakeSnapshot = {
          __values: {
            get [index]() {
              return v;
            },
          },
          __id: snapshot.__id,
          __elements: snapshot.__elements,
        } as SnapshotInstance;
        updateGesture(fakeSnapshot, index, oldValue[key], elementIndex, workletType);
      } else if ((match = key.match(eventRegExp))) {
        const workletType = match[2];
        const eventType = eventTypeMap[match[3]!]!;
        const eventName = match[4]!;
        const fakeSnapshot = {
          __values: {
            get [index]() {
              return v;
            },
            set [index](value: unknown) {
              // Modifications to the event value should be reflected in the corresponding position of the spread.
              newValue[key] = value;
            },
          },
          __id: snapshot.__id,
          __elements: snapshot.__elements,
        } as SnapshotInstance;
        if (workletType) {
          updateWorkletEvent(fakeSnapshot, index, oldValue[key], elementIndex, workletType, eventType, eventName);
        } else {
          updateEvent(fakeSnapshot, index, oldValue[key], elementIndex, eventType, eventName, key);
        }
      } else if (platformInfoAttributes.has(key)) {
        // ignore
      } else {
        __SetAttribute(snapshot.__elements[elementIndex]!, key, v);
      }
    }

    // collect data regardless of whether it has changed
    if (key.startsWith('data-')) {
      dataset[key.slice(5)] = v;
    }
  }

  let hasOldDataset = false;
  for (const key in oldValue) {
    if (!(key in newValue)) {
      if (key === 'className') {
        __SetClasses(snapshot.__elements[elementIndex]!, '');
      } else if (key === 'style') {
        __SetInlineStyles(snapshot.__elements[elementIndex]!, '');
      } else if (key === 'id') {
        __SetID(snapshot.__elements[elementIndex]!, null);
      } else if (key.startsWith('data-')) {
        // collected below
      } else if (key === 'ref') {
        snapshot.__ref_set ??= new Set();
        const fakeSnapshot = {
          __values: {
            get [index]() {
              return undefined;
            },
            set [index](value: unknown) {
              // Modifications to the ref value should be reflected in the corresponding position of the spread.
              newValue[key] = value;
            },
          },
          __id: snapshot.__id,
          __elements: snapshot.__elements,
          __ref_set: snapshot.__ref_set,
        } as SnapshotInstance;
        updateRef(fakeSnapshot, index, oldValue[key], elementIndex, key);
      } else if (key.endsWith(':ref')) {
        snapshot.__worklet_ref_set ??= new Set();
        const fakeSnapshot = {
          __values: {
            get [index]() {
              return undefined;
            },
          },
          __id: snapshot.__id,
          __elements: snapshot.__elements,
          __worklet_ref_set: snapshot.__worklet_ref_set,
        } as SnapshotInstance;
        updateWorkletRef(fakeSnapshot, index, oldValue[key], elementIndex, key.slice(0, -4));
      } else if (key.endsWith(':gesture')) {
        const workletType = key.slice(0, -8);
        const fakeSnapshot = {
          __values: {
            get [index]() {
              return undefined;
            },
          },
          __id: snapshot.__id,
          __elements: snapshot.__elements,
        } as SnapshotInstance;
        updateGesture(fakeSnapshot, index, oldValue[key], elementIndex, workletType);
      } else if ((match = key.match(eventRegExp))) {
        const workletType = match[2];
        const eventType = eventTypeMap[match[3]!]!;
        const eventName = match[4]!;
        const fakeSnapshot = {
          __values: {
            get [index]() {
              return undefined;
            },
            set [index](value: unknown) {
              newValue[key] = value;
            },
          },
          __id: snapshot.__id,
          __elements: snapshot.__elements,
        } as SnapshotInstance;
        if (workletType) {
          updateWorkletEvent(fakeSnapshot, index, oldValue[key], elementIndex, workletType, eventType, eventName);
        } else {
          updateEvent(fakeSnapshot, index, oldValue[key], elementIndex, eventType, eventName, key);
        }
      } else if (platformInfoAttributes.has(key)) {
        // ignore
      } else {
        __SetAttribute(snapshot.__elements[elementIndex]!, key, null);
      }
    }

    // collect data regardless of whether it has changed
    if (key.startsWith('data-')) {
      hasOldDataset = true;
    }
  }

  // TODO: compare dataset before commit it to native?
  if (hasOldDataset || !isEmptyObject(dataset)) {
    __SetDataset(snapshot.__elements[elementIndex]!, dataset);
  }
}

function transformSpread(
  snapshot: BackgroundSnapshotInstance | SnapshotInstance,
  index: number,
  spread: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let hasNoFlattenAttributes = false;
  for (const key in spread) {
    let value = spread[key];
    if (key === '__spread') {}
    else if (key === 'class' || key === 'className') {
      value ??= '';
      result['className'] = value;
    } else if (key === 'ref') {
      // @ts-ignore
      result[key] = transformRef(value)?.__ref;
    } else if (typeof value === 'function') {
      result[key] = `${snapshot.__id}:${index}:${key}`;
    } else {
      if (!hasNoFlattenAttributes && noFlattenAttributes.has(key)) {
        hasNoFlattenAttributes = true;
      }
      result[key] = value;
    }
  }

  if (hasNoFlattenAttributes) {
    result['flatten'] = false;
  }
  return result;
}

export { transformSpread, updateSpread };
