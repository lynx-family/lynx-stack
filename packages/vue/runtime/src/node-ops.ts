// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RendererOptions } from '@vue/runtime-core';

import { register, unregister, updateHandler } from './event-registry.js';
import { scheduleFlush } from './flush.js';
import { OP, pushOp } from './ops.js';
import { ShadowElement } from './shadow-element.js';

// ---------------------------------------------------------------------------
// Style normalisation – numeric values → 'Npx' (Lynx requires units)
// ---------------------------------------------------------------------------

// Properties that accept a bare number (no unit needed).
const DIMENSIONLESS = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'flexOrder',
  'order',
  'opacity',
  'zIndex',
  'aspectRatio',
  'fontWeight',
  'lineClamp',
]);

function normalizeStyle(
  style: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(style)) {
    const val = style[key];
    if (typeof val === 'number' && !DIMENSIONLESS.has(key)) {
      out[key] = val === 0 ? 0 : `${val}px`;
    } else {
      out[key] = val;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Event prop classification
// ---------------------------------------------------------------------------

interface EventSpec {
  type: string;
  name: string;
}

function parseEventProp(key: string): EventSpec | null {
  if (key.startsWith('global-bind')) {
    return { type: 'bindGlobalEvent', name: key.slice('global-bind'.length) };
  }
  if (key.startsWith('global-catch')) {
    return { type: 'catchGlobalEvent', name: key.slice('global-catch'.length) };
  }
  if (key.startsWith('catch')) {
    return { type: 'catchEvent', name: key.slice('catch'.length) };
  }
  if (/^bind(?!ingx)/.test(key)) {
    return { type: 'bindEvent', name: key.slice('bind'.length) };
  }
  if (/^on[A-Z]/.test(key)) {
    // onTap → { type: 'bindEvent', name: 'tap' }
    // onTouchStart → { type: 'bindEvent', name: 'touchStart' }
    const name = key.slice(2, 3).toLowerCase() + key.slice(3);
    return { type: 'bindEvent', name };
  }
  return null;
}

// Track the sign registered for each (element, propKey) so we can unregister
// on prop removal / update.
const elementEventSigns = new Map<number, Map<string, string>>();

// ---------------------------------------------------------------------------
// RendererOptions implementation
// ---------------------------------------------------------------------------

export const nodeOps: RendererOptions<ShadowElement, ShadowElement> = {
  createElement(type: string): ShadowElement {
    const el = new ShadowElement(type);
    pushOp(OP.CREATE, el.id, type);
    scheduleFlush();
    return el;
  },

  createText(text: string): ShadowElement {
    const el = new ShadowElement('#text');
    pushOp(OP.CREATE_TEXT, el.id);
    if (text) pushOp(OP.SET_TEXT, el.id, text);
    scheduleFlush();
    return el;
  },

  // Comment nodes are used by Vue as position anchors for v-if / Fragment.
  // We materialise them as invisible placeholder elements on the Main Thread.
  createComment(_text: string): ShadowElement {
    const el = new ShadowElement('#comment');
    pushOp(OP.CREATE, el.id, '__comment');
    scheduleFlush();
    return el;
  },

  setText(node: ShadowElement, text: string): void {
    pushOp(OP.SET_TEXT, node.id, text);
    scheduleFlush();
  },

  // Called when a host element's text content changes (e.g. h('text', null, dynamic)).
  setElementText(el: ShadowElement, text: string): void {
    // Remove all children from shadow tree
    while (el.firstChild) {
      const child = el.firstChild;
      el.removeChild(child);
      pushOp(OP.REMOVE, el.id, child.id);
    }
    // Set text content directly on the element
    pushOp(OP.SET_TEXT, el.id, text);
    scheduleFlush();
  },

  insert(
    child: ShadowElement,
    parent: ShadowElement,
    anchor?: ShadowElement | null,
  ): void {
    parent.insertBefore(child, anchor ?? null);
    const anchorId = anchor ? anchor.id : -1;
    pushOp(OP.INSERT, parent.id, child.id, anchorId);
    scheduleFlush();
  },

  remove(child: ShadowElement): void {
    if (child.parent) {
      const parentId = child.parent.id;
      child.parent.removeChild(child);
      pushOp(OP.REMOVE, parentId, child.id);
      scheduleFlush();
    }
  },

  patchProp(
    el: ShadowElement,
    key: string,
    _prevValue: unknown,
    nextValue: unknown,
  ): void {
    // ------------------------------------------------------------------
    // Main-thread worklet props: :main-thread-bindtap, :main-thread-ref
    // ------------------------------------------------------------------
    if (key.startsWith('main-thread-')) {
      const suffix = key.slice('main-thread-'.length);
      if (suffix === 'ref') {
        // MainThreadRef — send the serialised { _wvid, _initValue } to MT
        if (
          nextValue != null && typeof nextValue === 'object'
          && '_wvid' in (nextValue as Record<string, unknown>)
        ) {
          pushOp(
            OP.SET_MT_REF,
            el.id,
            (nextValue as { toJSON(): unknown }).toJSON(),
          );
        }
      } else {
        // Worklet event — suffix is an event key like "bindtap", "bindscroll"
        const event = parseEventProp(suffix);
        if (event && nextValue != null) {
          pushOp(
            OP.SET_WORKLET_EVENT,
            el.id,
            event.type,
            event.name,
            nextValue,
          );
        }
      }
      scheduleFlush();
      return;
    }

    const event = parseEventProp(key);

    if (event) {
      let signs = elementEventSigns.get(el.id);
      const oldSign = signs?.get(key);

      if (nextValue != null) {
        const handler = nextValue as (data: unknown) => void;
        if (oldSign) {
          // Re-render: update handler in-place so the sign on the Main Thread
          // stays valid.  No new SET_EVENT op needed.
          updateHandler(oldSign, handler);
        } else {
          // First time this event is bound on this element.
          const sign = register(handler);
          if (!signs) {
            signs = new Map<string, string>();
            elementEventSigns.set(el.id, signs);
          }
          signs.set(key, sign);
          pushOp(OP.SET_EVENT, el.id, event.type, event.name, sign);
        }
      } else if (oldSign) {
        // Handler removed entirely.
        unregister(oldSign);
        signs!.delete(key);
        pushOp(OP.REMOVE_EVENT, el.id, event.type, event.name);
      }
    } else if (key === 'style') {
      const style = nextValue != null && typeof nextValue === 'object'
        ? normalizeStyle(nextValue as Record<string, unknown>)
        : {};
      el._style = style;
      const effective = el._vShowHidden ? { ...style, display: 'none' } : style;
      pushOp(OP.SET_STYLE, el.id, effective);
    } else if (key === 'class') {
      pushOp(OP.SET_CLASS, el.id, nextValue);
    } else if (key === 'id') {
      pushOp(OP.SET_ID, el.id, nextValue);
    } else {
      pushOp(OP.SET_PROP, el.id, key, nextValue);
    }

    scheduleFlush();
  },

  parentNode(node: ShadowElement): ShadowElement | null {
    return node.parent;
  },

  nextSibling(node: ShadowElement): ShadowElement | null {
    return node.next;
  },
};

/** Reset module state – for testing only. */
export function resetNodeOpsState(): void {
  elementEventSigns.clear();
}
