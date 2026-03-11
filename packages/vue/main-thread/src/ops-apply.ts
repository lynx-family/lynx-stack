// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Main Thread ops executor.
 *
 * Receives the flat-array ops buffer sent by the Background Thread via
 * callLepusMethod('vuePatchUpdate', { data: JSON.stringify(ops) }) and applies
 * each operation using Lynx PAPI.
 */

import { OP } from '@lynx-js/vue-internal/ops';

import { elements } from './element-registry.js';
import {
  createListElement,
  flushListUpdates,
  insertListItem,
  isListParent,
  isPlatformInfoAttr,
  resetListState,
  setPlatformInfoProp,
} from './list-apply.js';
import {
  applyInitMtRef,
  applySetMtRef,
  applySetWorkletEvent,
  resetWorkletState,
} from './worklet-apply.js';

/**
 * Use typed PAPI creators for known element types.
 * Native Lynx may set up type-specific internals (e.g. overflow clipping
 * for View, hardware-accelerated decoding for Image) via the typed functions
 * that the generic __CreateElement does not.
 */
function createTypedElement(type: string, id: number): LynxElement {
  switch (type) {
    case 'view':
      return __CreateView(id);
    case 'image':
      return __CreateImage(id);
    case 'scroll-view':
      return __CreateScrollView(id);
    default:
      return __CreateElement(type, id);
  }
}

export function applyOps(ops: unknown[]): void {
  const len = ops.length;
  if (len === 0) return;

  // Detect duplicate batch from double BG bundle evaluation.
  // Each __init_card_bundle__ invocation gets a fresh webpack module cache, so
  // ShadowElement.nextId resets to 2, producing the same element IDs.
  // If the first CREATE op targets an ID that already exists in our elements Map,
  // this is a duplicate batch — skip it entirely.
  if (len >= 3 && ops[0] === OP.CREATE) {
    const firstId = ops[1] as number;
    if (elements.has(firstId)) {
      return;
    }
  }

  let i = 0;

  while (i < len) {
    const code = ops[i++] as number;

    switch (code) {
      case OP.CREATE: {
        const id = ops[i++] as number;
        const type = ops[i++] as string;
        let el: LynxElement;
        if (type === '__comment') {
          // Vue uses comment nodes as Fragment / v-if anchors.
          // Create a zero-size text node as an invisible placeholder.
          el = __CreateRawText('');
        } else if (type === 'list') {
          el = createListElement(id);
        } else {
          // Use typed PAPI creators for known element types.
          // Native Lynx sets up type-specific internals (e.g. overflow
          // clipping for __CreateView) that __CreateElement may skip.
          el = createTypedElement(type, 0);
          // Associate element with CSS scope 0 (common/global CSS)
          // so the CSS selector engine can match class-based rules.
          __SetCSSId([el], 0);
        }
        elements.set(id, el);
        // Set selector attribute for BG-thread NodesRef queries.
        // Comment nodes (__CreateRawText) can't have attributes.
        if (type !== '__comment') {
          __SetAttribute(el, `vue-ref-${id}`, 1);
        }
        break;
      }

      case OP.CREATE_TEXT: {
        const id = ops[i++] as number;
        const el = __CreateText(0);
        __SetCSSId([el], 0);
        elements.set(id, el);
        // Set selector attribute for BG-thread NodesRef queries
        __SetAttribute(el, `vue-ref-${id}`, 1);
        break;
      }

      case OP.INSERT: {
        const parentId = ops[i++] as number;
        const childId = ops[i++] as number;
        const anchorId = ops[i++] as number;
        const parent = elements.get(parentId);
        const child = elements.get(childId);
        if (parent && child) {
          if (isListParent(parentId)) {
            insertListItem(parentId, child, childId);
          } else if (anchorId === -1) {
            __AppendElement(parent, child);
          } else {
            const anchor = elements.get(anchorId);
            if (anchor) __InsertElementBefore(parent, child, anchor);
          }
        }
        break;
      }

      case OP.REMOVE: {
        const parentId = ops[i++] as number;
        const childId = ops[i++] as number;
        const parent = elements.get(parentId);
        const child = elements.get(childId);
        if (parent && child) {
          __RemoveElement(parent, child);
        }
        break;
      }

      case OP.SET_PROP: {
        const id = ops[i++] as number;
        const key = ops[i++] as string;
        const value = ops[i++];
        if (isPlatformInfoAttr(key)) {
          setPlatformInfoProp(id, key, value);
        } else {
          const el = elements.get(id);
          if (el) __SetAttribute(el, key, value);
        }
        break;
      }

      case OP.SET_TEXT: {
        const id = ops[i++] as number;
        const text = ops[i++] as string;
        const el = elements.get(id);
        if (el) __SetAttribute(el, 'text', text);
        break;
      }

      case OP.SET_EVENT: {
        const id = ops[i++] as number;
        const eventType = ops[i++] as string;
        const eventName = ops[i++] as string;
        const sign = ops[i++];
        const el = elements.get(id);
        console.info(
          '[vue-mt] SET_EVENT id=',
          id,
          'type=',
          eventType,
          'name=',
          eventName,
          'sign=',
          sign,
          'el found=',
          el != null,
        );
        if (el) __AddEvent(el, eventType, eventName, sign as string);
        break;
      }

      case OP.REMOVE_EVENT: {
        // PAPI does not expose a remove-event API; skip both params
        i += 3; // id, eventType, eventName
        break;
      }

      case OP.SET_STYLE: {
        const id = ops[i++] as number;
        const value = ops[i++] as string | object;
        const el = elements.get(id);
        if (el) __SetInlineStyles(el, value);
        break;
      }

      case OP.SET_CLASS: {
        const id = ops[i++] as number;
        const cls = ops[i++] as string;
        const el = elements.get(id);
        if (el) __SetClasses(el, cls);
        break;
      }

      case OP.SET_ID: {
        const id = ops[i++] as number;
        const idStr = ops[i++] as string | null | undefined;
        const el = elements.get(id);
        if (el) __SetID(el, idStr ?? undefined);
        break;
      }

      case OP.SET_WORKLET_EVENT: {
        const id = ops[i++] as number;
        const eventType = ops[i++] as string;
        const eventName = ops[i++] as string;
        const ctx = ops[i++] as Record<string, unknown>;
        applySetWorkletEvent(id, eventType, eventName, ctx);
        break;
      }

      case OP.SET_MT_REF: {
        const id = ops[i++] as number;
        const refImpl = ops[i++];
        applySetMtRef(id, refImpl);
        break;
      }

      case OP.INIT_MT_REF: {
        const wvid = ops[i++] as number;
        const initValue = ops[i++];
        applyInitMtRef(wvid, initValue);
        break;
      }

      default:
        // Unknown op – skip (future-compat)
        break;
    }
  }

  flushListUpdates();

  // Flush all pending PAPI changes to the native layer in one shot.
  __FlushElementTree();
}

/** Expose elements map so entry-main.ts can seed the page-root entry. */
export { elements };

/** Reset module state – for testing only. */
export function resetMainThreadState(): void {
  elements.clear();
  resetListState();
  resetWorkletState();
}
