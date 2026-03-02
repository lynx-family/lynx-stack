// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RendererOptions } from '@vue/runtime-core'

import { register, unregister } from './event-registry.js'
import { scheduleFlush } from './flush.js'
import { OP, pushOp } from './ops.js'
import { ShadowElement } from './shadow-element.js'

// ---------------------------------------------------------------------------
// Event prop classification
// ---------------------------------------------------------------------------

const RE_ON_EVENT = /^on[A-Z]/
const RE_BIND_EVENT = /^bind(?!ingx)/  // bindtap etc., but NOT bindingx
const RE_CATCH_EVENT = /^catch/
const RE_GLOBAL_BIND = /^global-bind/
const RE_GLOBAL_CATCH = /^global-catch/

interface EventSpec {
  type: string
  name: string
}

function parseEventProp(key: string): EventSpec | null {
  if (RE_GLOBAL_BIND.test(key)) {
    return { type: 'bindGlobalEvent', name: key.slice('global-bind'.length) }
  }
  if (RE_GLOBAL_CATCH.test(key)) {
    return { type: 'catchGlobalEvent', name: key.slice('global-catch'.length) }
  }
  if (RE_CATCH_EVENT.test(key)) {
    return { type: 'catchEvent', name: key.slice('catch'.length) }
  }
  if (RE_BIND_EVENT.test(key)) {
    return { type: 'bindEvent', name: key.slice('bind'.length) }
  }
  if (RE_ON_EVENT.test(key)) {
    // onTap → { type: 'bindEvent', name: 'tap' }
    // onTouchStart → { type: 'bindEvent', name: 'touchStart' }
    const name = key.slice(2, 3).toLowerCase() + key.slice(3)
    return { type: 'bindEvent', name }
  }
  return null
}

// Track the sign registered for each (element, propKey) so we can unregister
// on prop removal / update.
const elementEventSigns = new Map<number, Map<string, string>>()

// ---------------------------------------------------------------------------
// RendererOptions implementation
// ---------------------------------------------------------------------------

export const nodeOps: RendererOptions<ShadowElement, ShadowElement> = {
  createElement(type: string): ShadowElement {
    const el = new ShadowElement(type)
    pushOp(OP.CREATE, el.id, type)
    scheduleFlush()
    return el
  },

  createText(text: string): ShadowElement {
    const el = new ShadowElement('#text')
    pushOp(OP.CREATE_TEXT, el.id)
    if (text) pushOp(OP.SET_TEXT, el.id, text)
    scheduleFlush()
    return el
  },

  // Comment nodes are used by Vue as position anchors for v-if / Fragment.
  // We materialise them as invisible placeholder elements on the Main Thread.
  createComment(_text: string): ShadowElement {
    const el = new ShadowElement('#comment')
    pushOp(OP.CREATE, el.id, '__comment')
    scheduleFlush()
    return el
  },

  setText(node: ShadowElement, text: string): void {
    pushOp(OP.SET_TEXT, node.id, text)
    scheduleFlush()
  },

  // Called when a host element's text content changes (e.g. h('text', null, dynamic)).
  setElementText(el: ShadowElement, text: string): void {
    // Remove all children from shadow tree
    while (el.firstChild) {
      const child = el.firstChild
      el.removeChild(child)
      pushOp(OP.REMOVE, el.id, child.id)
    }
    // Set text content directly on the element
    pushOp(OP.SET_TEXT, el.id, text)
    scheduleFlush()
  },

  insert(
    child: ShadowElement,
    parent: ShadowElement,
    anchor?: ShadowElement | null,
  ): void {
    parent.insertBefore(child, anchor ?? null)
    const anchorId = anchor ? anchor.id : -1
    pushOp(OP.INSERT, parent.id, child.id, anchorId)
    scheduleFlush()
  },

  remove(child: ShadowElement): void {
    if (child.parent) {
      const parentId = child.parent.id
      child.parent.removeChild(child)
      pushOp(OP.REMOVE, parentId, child.id)
      scheduleFlush()
    }
  },

  patchProp(
    el: ShadowElement,
    key: string,
    prevValue: unknown,
    nextValue: unknown,
  ): void {
    const event = parseEventProp(key)

    if (event) {
      // Tear down previous handler
      let signs = elementEventSigns.get(el.id)
      const oldSign = signs?.get(key)
      if (oldSign) {
        unregister(oldSign)
        pushOp(OP.REMOVE_EVENT, el.id, event.type, event.name)
      }
      if (nextValue != null) {
        const handler = nextValue as (data: unknown) => void
        const sign = register(handler)
        if (!signs) {
          signs = new Map<string, string>()
          elementEventSigns.set(el.id, signs)
        }
        signs.set(key, sign)
        pushOp(OP.SET_EVENT, el.id, event.type, event.name, sign)
      } else {
        signs?.delete(key)
      }
    } else if (key === 'style') {
      pushOp(OP.SET_STYLE, el.id, nextValue)
    } else if (key === 'class') {
      pushOp(OP.SET_CLASS, el.id, nextValue)
    } else if (key === 'id') {
      pushOp(OP.SET_ID, el.id, nextValue)
    } else {
      pushOp(OP.SET_PROP, el.id, key, nextValue)
    }

    scheduleFlush()
  },

  parentNode(node: ShadowElement): ShadowElement | null {
    return node.parent
  },

  nextSibling(node: ShadowElement): ShadowElement | null {
    return node.next
  },
}
