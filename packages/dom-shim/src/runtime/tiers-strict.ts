// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { DOMShimUnsupportedError } from './errors.ts';
import type {
  L1ReadOnlyElement,
  L1ReadOnlyNode,
  L2SafeWritableElement,
  L3aEventfulElement,
  L3bUnsafeWritableElement,
} from './nodes.ts';

/**
 * Strict tier-narrowing helpers. See Shim_Design.md §2 "Tier selection"
 * + OQ-S.6. These wrap the element in a Proxy that throws
 * `DOMShimUnsupportedError({ code: 'L4/tier-violation' })` whenever a
 * higher-tier method is accessed.
 *
 * The lists of L2 / L3a / L3b method names are explicit so we don't
 * accidentally allow / deny something. Inherited L1 getters are always
 * permitted.
 */

const L1_PROPERTY_ALLOWLIST = new Set<string>([
  // L1ReadOnlyNode
  'nodeType',
  'nodeName',
  'nodeValue',
  'parentNode',
  'parentElement',
  'firstChild',
  'lastChild',
  'nextSibling',
  'previousSibling',
  'childNodes',
  'hasChildNodes',
  'isConnected',
  'getRootNode',
  'contains',
  'compareDocumentPosition',
  'isEqualNode',
  'isSameNode',
  'textContent',
  // L1ReadOnlyElement
  'id',
  'tagName',
  'localName',
  'className',
  'classList',
  'getAttribute',
  'getAttributeNames',
  'hasAttribute',
  'hasAttributes',
  'attributes',
  'dataset',
  'children',
  'firstElementChild',
  'lastElementChild',
  'nextElementSibling',
  'previousElementSibling',
  'childElementCount',
  'querySelector',
  'querySelectorAll',
  'matches',
  'closest',
  'getBoundingClientRect',
  // Shim-internal
  'papi',
  'constructor',
  'toString',
  'toJSON',
]);

const L2_METHOD_ADDITIONS = new Set<string>([
  'setAttribute',
  'removeAttribute',
  'toggleAttribute',
  'appendChild',
  'insertBefore',
  'removeChild',
  'replaceChild',
  'append',
  'prepend',
  'before',
  'after',
  'replaceWith',
  'remove',
  'cloneNode',
  'style',
]);

const L3A_METHOD_ADDITIONS = new Set<string>([
  'addEventListener',
  'removeEventListener',
  'dispatchEvent',
]);

const L3B_METHOD_ADDITIONS = new Set<string>([
  'innerHTML',
  'outerHTML',
  'insertAdjacentHTML',
  'insertAdjacentText',
]);

function buildAllowList(tier: 1 | 2 | 3 | 4, includeL3b: boolean): Set<string> {
  const all = new Set(L1_PROPERTY_ALLOWLIST);
  if (tier >= 2) { for (const m of L2_METHOD_ADDITIONS) all.add(m); }
  if (tier >= 3) { for (const m of L3A_METHOD_ADDITIONS) all.add(m); }
  if (includeL3b) { for (const m of L3B_METHOD_ADDITIONS) all.add(m); }
  return all;
}

function narrow<T extends L1ReadOnlyNode>(
  el: T,
  tier: 1 | 2 | 3,
  includeL3b: boolean,
  tierLabel: string,
): T {
  const allow = buildAllowList(tier, includeL3b);
  return new Proxy(el, {
    get(target, prop, receiver): unknown {
      if (typeof prop === 'symbol' || allow.has(prop)) {
        return Reflect.get(target, prop, receiver);
      }
      throw new DOMShimUnsupportedError({
        code: 'L4/tier-violation',
        surface: `Element.${String(prop)}`,
        message: `Property "${
          String(prop)
        }" is above the narrowed tier ${tierLabel}.`,
        suggestion: `Drop the strict cast or use a higher tier.`,
      });
    },
    set(target, prop, value, receiver): boolean {
      if (typeof prop === 'symbol' || allow.has(prop)) {
        return Reflect.set(target, prop, value, receiver);
      }
      throw new DOMShimUnsupportedError({
        code: 'L4/tier-violation',
        surface: `Element.${String(prop)}`,
        message: `Setter "${
          String(prop)
        }" is above the narrowed tier ${tierLabel}.`,
      });
    },
  });
}

/** Strict L1 narrowing — runtime throws on L2+ access. */
export function ReadOnly<T extends L1ReadOnlyNode>(el: T): L1ReadOnlyElement {
  return narrow(el, 1, false, 'L1 ReadOnly') as unknown as L1ReadOnlyElement;
}

/** Strict L2 narrowing — runtime throws on L3+ access. */
export function SafeWrite<T extends L1ReadOnlyNode>(
  el: T,
): L2SafeWritableElement {
  return narrow(
    el,
    2,
    false,
    'L2 SafeWrite',
  ) as unknown as L2SafeWritableElement;
}

/** Strict L3a narrowing — runtime throws on L3b access. */
export function Events<T extends L1ReadOnlyNode>(
  el: T,
): L3aEventfulElement {
  return narrow(el, 3, false, 'L3a Events') as unknown as L3aEventfulElement;
}

/** Strict L3b narrowing — allows all but distinguishes UNSAFE for callsites. */
export function Unsafe<T extends L1ReadOnlyNode>(
  el: T,
): L3bUnsafeWritableElement {
  return narrow(
    el,
    3,
    true,
    'L3b Unsafe',
  ) as unknown as L3bUnsafeWritableElement;
}
