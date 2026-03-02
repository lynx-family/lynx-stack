// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Main Thread ops executor.
 *
 * Receives the flat-array ops buffer sent by the Background Thread via
 * callLepusMethod('vuePatchUpdate', { data: JSON.stringify(ops) }) and applies
 * each operation using Lynx PAPI.
 *
 * Op format mirrors packages/vue/runtime/src/ops.ts – keep in sync.
 */

// Op codes (mirrored from runtime/ops.ts – must stay in sync)
const OP = {
  CREATE: 0,
  CREATE_TEXT: 1,
  INSERT: 2,
  REMOVE: 3,
  SET_PROP: 4,
  SET_TEXT: 5,
  SET_EVENT: 6,
  REMOVE_EVENT: 7,
  SET_STYLE: 8,
  SET_CLASS: 9,
  SET_ID: 10,
} as const

/** Map from BG-thread ShadowElement id → Lynx Main Thread element handle */
const elements = new Map<number, LynxElement>()

export function applyOps(ops: unknown[]): void {
  const len = ops.length
  let i = 0

  while (i < len) {
    const code = ops[i++] as number

    switch (code) {
      case OP.CREATE: {
        const id = ops[i++] as number
        const type = ops[i++] as string
        let el: LynxElement
        if (type === '__comment') {
          // Vue uses comment nodes as Fragment / v-if anchors.
          // Create a zero-size text node as an invisible placeholder.
          el = __CreateRawText('')
        } else {
          el = __CreateElement(type, 0)
        }
        elements.set(id, el)
        break
      }

      case OP.CREATE_TEXT: {
        const id = ops[i++] as number
        const el = __CreateText(0)
        elements.set(id, el)
        break
      }

      case OP.INSERT: {
        const parentId = ops[i++] as number
        const childId = ops[i++] as number
        const anchorId = ops[i++] as number
        const parent = elements.get(parentId)
        const child = elements.get(childId)
        if (parent && child) {
          if (anchorId === -1) {
            __AppendElement(parent, child)
          } else {
            const anchor = elements.get(anchorId)
            __InsertElementBefore(parent, child, anchor)
          }
        }
        break
      }

      case OP.REMOVE: {
        const parentId = ops[i++] as number
        const childId = ops[i++] as number
        const parent = elements.get(parentId)
        const child = elements.get(childId)
        if (parent && child) {
          __RemoveElement(parent, child)
        }
        break
      }

      case OP.SET_PROP: {
        const id = ops[i++] as number
        const key = ops[i++] as string
        const value = ops[i++]
        const el = elements.get(id)
        if (el) __SetAttribute(el, key, value)
        break
      }

      case OP.SET_TEXT: {
        const id = ops[i++] as number
        const text = ops[i++] as string
        const el = elements.get(id)
        if (el) __SetAttribute(el, 'text', text)
        break
      }

      case OP.SET_EVENT: {
        const id = ops[i++] as number
        const eventType = ops[i++] as string
        const eventName = ops[i++] as string
        const sign = ops[i++]
        const el = elements.get(id)
        if (el) __AddEvent(el, eventType, eventName, sign)
        break
      }

      case OP.REMOVE_EVENT: {
        // PAPI does not expose a remove-event API; skip both params
        i += 3 // id, eventType, eventName
        break
      }

      case OP.SET_STYLE: {
        const id = ops[i++] as number
        const value = ops[i++] as string | object
        const el = elements.get(id)
        if (el) __SetInlineStyles(el, value)
        break
      }

      case OP.SET_CLASS: {
        const id = ops[i++] as number
        const cls = ops[i++] as string
        const el = elements.get(id)
        if (el) __SetClasses(el, cls)
        break
      }

      case OP.SET_ID: {
        const id = ops[i++] as number
        const idStr = ops[i++] as string | null | undefined
        const el = elements.get(id)
        if (el) __SetID(el, idStr)
        break
      }

      default:
        // Unknown op – skip (future-compat)
        break
    }
  }

  // Flush all pending PAPI changes to the native layer in one shot.
  __FlushElementTree()
}

/** Expose elements map so entry-main.ts can seed the page-root entry. */
export { elements }
