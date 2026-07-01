// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  L1ReadOnlyText,
  L3aEventfulElement,
  createDocumentFragment as _createDocumentFragment,
  recordTextValue,
  wrapPapi,
} from './nodes.ts';
import type { ShimDocumentFragment } from './nodes.ts';
import type { ElementRef } from './papi-types.ts';
import { htmlToLynx } from './tag-map.ts';

/**
 * Document stand-in. See Shim_Design.md §9.
 *
 * Tag mapping delegates to `tag-map.ts` (US-441) which loads the
 * versioned table from SPEC/TAG_MAP.json. Unmapped tags fall back to
 * __CreateView per OQ-S.2 (permissive default), with `data-shim-tag="X"`
 * preserving the original HTML tag for diagnostics.
 */

let bodyOverride: ElementRef | null = null;
let bodyChoiceLogged = false;

/**
 * Pin the body element. Optional Shim init hook per OQ-S.7. When unset,
 * `document.body` defaults to the page's first child (or the page itself
 * when childless) and logs the choice once via `console.info`.
 */
export function setBody(ref: ElementRef | null): void {
  bodyOverride = ref;
}

function resolveBody(): ElementRef {
  if (bodyOverride !== null) return bodyOverride;
  const page = __GetPageElement();
  const first = __FirstElement(page);
  if (!bodyChoiceLogged) {
    bodyChoiceLogged = true;
    console.info(
      JSON.stringify({
        code: 'shim:doc/body-choice',
        message: first
          ? 'document.body resolves to page\'s first child (set via setBody to override).'
          : 'document.body resolves to the page element itself (no children).',
      }),
    );
  }
  return first ?? page;
}

/**
 * Determine the parentComponentUniId to pass into PAPI create functions.
 * For the Shim today, all Shim-created elements live under the page
 * element. Real engine integrations may set this via a Shim init API in a
 * future story.
 */
function pageComponentId(): number {
  try {
    const page = __GetPageElement();
    return __GetElementUniqueID(page);
  } catch {
    return 0;
  }
}

function buildElement(htmlTag: string): ElementRef | null {
  const outcome = htmlToLynx(htmlTag);
  const compId = pageComponentId();

  if (outcome.kind === 'skipped') {
    if (outcome.divergence) {
      console.warn(
        JSON.stringify({
          code: outcome.divergence,
          tier: 3,
          surface: 'document.createElement',
          message: `<${htmlTag}> is skipped (not created).`,
        }),
      );
    }
    return null;
  }

  if (outcome.kind === 'fallback') {
    // OQ-S.2 permissive: unmapped → view + data-shim-tag="X".
    const ref = __CreateView(compId);
    __SetAttribute(ref, 'data-shim-tag', outcome.rawTag);
    return ref;
  }

  const { factory, rawTag, defaultClasses } = outcome.result;
  let ref: ElementRef;
  switch (factory) {
    case 'view':
      ref = __CreateView(compId);
      break;
    case 'text':
      ref = __CreateText(compId);
      break;
    case 'image':
      ref = __CreateImage(compId);
      break;
    case 'scrollView':
      ref = __CreateScrollView(compId);
      break;
    case 'element':
      ref = __CreateElement(rawTag ?? htmlTag.toLowerCase(), compId);
      break;
    default:
      ref = __CreateView(compId);
  }

  if (defaultClasses && defaultClasses.length > 0) {
    __SetAttribute(ref, 'class', defaultClasses.join(' '));
  }
  return ref;
}

/** Test-only: reset module-level state between tests. */
export function _resetDocumentForTesting(): void {
  bodyOverride = null;
  bodyChoiceLogged = false;
}

export interface ShimDocument {
  readonly documentElement: L3aEventfulElement;
  readonly body: L3aEventfulElement;
  createElement(tag: string): L3aEventfulElement;
  createTextNode(data: string): L1ReadOnlyText;
  createDocumentFragment(): ShimDocumentFragment;
  querySelector(selector: string): L3aEventfulElement | null;
  querySelectorAll(selector: string): readonly L3aEventfulElement[];
  getElementById(id: string): L3aEventfulElement | null;
  getElementsByClassName(name: string): readonly L3aEventfulElement[];
  getElementsByTagName(tag: string): readonly L3aEventfulElement[];
}

/**
 * Document stand-in. Sealed object — callers should not mutate it.
 */
export const document: ShimDocument = Object.freeze({
  /** Page-root wrapped as an Element. */
  get documentElement(): L3aEventfulElement {
    return wrapPapi(__GetPageElement()) as L3aEventfulElement;
  },

  /** See OQ-S.7 resolution in resolveBody(). */
  get body(): L3aEventfulElement {
    return wrapPapi(resolveBody()) as L3aEventfulElement;
  },

  createElement(tag: string): L3aEventfulElement {
    let ref = buildElement(tag);
    if (ref === null) {
      // Skipped tag — return an inert view stamped with data-shim-skipped
      // so callers can detect the divergence. The corresponding divergence
      // code was already console.warn'd by buildElement.
      ref = __CreateView(pageComponentId());
      __SetAttribute(ref, 'data-shim-tag', tag.toLowerCase());
      __SetAttribute(ref, 'data-shim-skipped', 'true');
    }
    return wrapPapi(ref) as L3aEventfulElement;
  },

  createTextNode(data: string): L1ReadOnlyText {
    const ref = __CreateRawText(data);
    recordTextValue(ref, data);
    return new L1ReadOnlyText(ref);
  },

  createDocumentFragment(): ShimDocumentFragment {
    return _createDocumentFragment(pageComponentId());
  },

  querySelector(selector: string): L3aEventfulElement | null {
    const ref = __QuerySelector(__GetPageElement(), selector, {
      onlyCurrentComponent: false,
    });
    if (ref === undefined || ref === null) return null;
    const wrapped = wrapPapi(ref);
    return wrapped instanceof L3aEventfulElement ? wrapped : null;
  },

  querySelectorAll(selector: string): readonly L3aEventfulElement[] {
    const refs = __QuerySelectorAll(__GetPageElement(), selector, {
      onlyCurrentComponent: false,
    });
    const out: L3aEventfulElement[] = [];
    for (const r of refs) {
      const w = wrapPapi(r);
      if (w instanceof L3aEventfulElement) out.push(w);
    }
    return Object.freeze(out);
  },

  getElementById(id: string): L3aEventfulElement | null {
    return this.querySelector(`#${id}`);
  },

  getElementsByClassName(name: string): readonly L3aEventfulElement[] {
    return this.querySelectorAll(`.${name}`);
  },

  getElementsByTagName(tag: string): readonly L3aEventfulElement[] {
    return this.querySelectorAll(tag.toLowerCase());
  },
});
