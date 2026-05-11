// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Snapshot manager that manages all snapshot definitions.
 */
import { DEFAULT_ENTRY_NAME } from './constants.js';
import {
  DynamicPartType,
  __DynamicPartChildren_0,
  __DynamicPartListSlotV2_0,
  __DynamicPartSlotV2_0,
} from './dynamicPartType.js';
import { snapshotCreateList } from './list.js';
import type { SnapshotInstance } from './snapshot.js';
import { updateSpread } from './spread.js';
import { entryUniqID } from './utils.js';
import { SnapshotOperation, __globalSnapshotPatch } from '../lifecycle/patch/snapshotPatch.js';

// Declared globally at runtime; kept here for TS/ESLint project resolution.
declare function __CreateScrollView(parentComponentUniqueId: number): FiberElement;
declare function __CreateFrame(parentComponentUniqueId: number): FiberElement;

export let __page: FiberElement;
export let __pageId = 0;
export function setupPage(page: FiberElement): void {
  __page = page;
  __pageId = __GetElementUniqueID(page);
}

export function clearPage(): void {
  __page = undefined as unknown as FiberElement;
  __pageId = 0;
}

/**
 * A snapshot definition that contains all the information needed to create and update elements
 * This is generated at compile time through static analysis of the JSX
 */
export interface Snapshot {
  create: null | ((ctx: SnapshotInstance) => FiberElement[]);
  update: null | ((ctx: SnapshotInstance, index: number, oldValue: any) => void)[];
  slot: [DynamicPartType, number][];

  isListHolder?: boolean;
  isSlotV2?: boolean;
  cssId?: number | undefined;
  entryName?: string | undefined;
  refAndSpreadIndexes?: number[] | null;
}

/**
 * Manager for snapshot definitions
 */
export const snapshotManager: {
  values: Map<string, Snapshot>;
} = {
  values: /* @__PURE__ */ new Map<string, Snapshot>([
    [
      'root',
      {
        create() {
          /* v8 ignore start */
          if (__JS__ && !__DEV__) {
            return [];
          }
          /* v8 ignore stop */
          return [__page!];
        },
        update: [],
        slot: __DynamicPartChildren_0,
        isListHolder: false,
        cssId: 0,
      },
    ],
    [
      'wrapper',
      {
        create() {
          /* v8 ignore start */
          if (__JS__ && !__DEV__) {
            return [];
          }
          /* v8 ignore stop */
          return [__CreateWrapperElement(__pageId)];
        },
        update: [],
        slot: __DynamicPartChildren_0,
        isListHolder: false,
      },
    ],
    [
      null as unknown as string,
      {
        create() {
          /* v8 ignore start */
          if (__JS__ && !__DEV__) {
            return [];
          }
          /* v8 ignore stop */
          return [__CreateRawText('')];
        },
        update: [
          ctx => {
            /* v8 ignore start */
            if (__JS__ && !__DEV__) {
              return;
            }
            /* v8 ignore stop */
            if (ctx.__elements) {
              __SetAttribute(ctx.__elements[0]!, 'text', ctx.__values![0]);
            }
          },
        ],
        slot: [],
        isListHolder: false,
      },
    ],
  ]),
};

/**
 * Creates a new snapshot definition and adds it to the manager
 */
export function createSnapshot(
  uniqID: string,
  create: Snapshot['create'] | null,
  update: Snapshot['update'] | null,
  slot: Snapshot['slot'],
  cssId: number | undefined,
  entryName: string | undefined,
  refAndSpreadIndexes: number[] | null,
  isLazySnapshotSupported: boolean = false,
): string {
  if (!isLazySnapshotSupported) {
    uniqID = entryUniqID(uniqID, entryName);
  }
  // For Lazy Bundle, their entryName is not DEFAULT_ENTRY_NAME.
  // We need to set the entryName correctly for HMR
  if (
    __DEV__ && __JS__ && __globalSnapshotPatch && entryName && entryName !== DEFAULT_ENTRY_NAME
    // `uniqID` will be `https://example.com/main.lynx.bundle:__snapshot_835da_eff1e_1` when loading a standalone lazy bundle after hydration.
    && !uniqID.includes(':')
  ) {
    __globalSnapshotPatch.push(
      SnapshotOperation.DEV_ONLY_SetSnapshotEntryName,
      uniqID,
      entryName,
    );
  }

  const s: Snapshot = { create, update, slot, cssId, entryName, refAndSpreadIndexes };
  snapshotManager.values.set(uniqID, s);
  if (slot && slot[0]) {
    const v = slot[0][0];
    if (v === DynamicPartType.ListChildren || v === DynamicPartType.ListSlotV2) {
      s.isListHolder = true;
    }
    s.isSlotV2 = slot.every(([type]) => type === DynamicPartType.SlotV2 || type === DynamicPartType.ListSlotV2);
  }
  return uniqID;
}

export function createRuntimeSnapshot(type: string): void {
  const isListHolder = type === 'list';
  snapshotManager.values.set(type, {
    create(snapshotInstance) {
      /* v8 ignore start */
      if (__JS__ && !__DEV__) {
        return [];
      }
      // Keep runtime-created element creation consistent with the compiled snapshot path
      // (see swc_plugin_snapshot tag dispatch).
      switch (type) {
        case 'view':
          return [__CreateView(__pageId)];
        case 'scroll-view':
        case 'x-scroll-view':
          return [__CreateScrollView(__pageId)];
        case 'image':
          return [__CreateImage(__pageId)];
        case 'text':
          return [__CreateText(__pageId)];
        case 'wrapper':
          return [__CreateWrapperElement(__pageId)];
        case 'list':
          return [snapshotCreateList(__pageId, snapshotInstance, 0)];
        case 'frame':
          return [__CreateFrame(__pageId)];
        default:
          return [__CreateElement(type, __pageId)];
      }
      /* v8 ignore stop */
    },
    update: [
      (ctx, index, oldValue) => {
        /* v8 ignore start */
        if (__JS__ && !__DEV__) {
          return;
        }
        /* v8 ignore stop */
        updateSpread(ctx, index, oldValue as Record<string, unknown>, 0);
      },
    ],
    slot: isListHolder ? __DynamicPartListSlotV2_0 : __DynamicPartSlotV2_0,
    isListHolder,
    refAndSpreadIndexes: [0],
  });
}
