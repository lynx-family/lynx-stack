// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  L1ReadOnlyElement,
  L1ReadOnlyText,
  createDocumentFragment as _createDocumentFragment,
  recordTextValue,
  wrapPapi,
} from './nodes.ts';
import type { ShimDocumentFragment } from './nodes.ts';
import type { ElementRef } from './papi-types.ts';

/**
 * Document stand-in. See Shim_Design.md §9.
 *
 * Minimal HTML→Lynx tag map (US-425). US-441 supersedes with the full
 * SPEC/TAG_MAP.json. Unmapped tags fall back to __CreateView per OQ-S.2
 * (permissive default), with `data-shim-tag="X"` preserving the original
 * HTML tag for diagnostics.
 */

interface ShimElementInfo {
  lynxFactory:
    | 'view'
    | 'text'
    | 'image'
    | 'scrollView'
    | 'element';
  /** When lynxFactory === 'element', pass this through as the PAPI tag. */
  rawTag?: string;
}

const TAG_MAP: Readonly<Record<string, ShimElementInfo>> = Object.freeze({
  div: { lynxFactory: 'view' },
  span: { lynxFactory: 'text' },
  p: { lynxFactory: 'view' },
  h1: { lynxFactory: 'text' },
  h2: { lynxFactory: 'text' },
  h3: { lynxFactory: 'text' },
  h4: { lynxFactory: 'text' },
  h5: { lynxFactory: 'text' },
  h6: { lynxFactory: 'text' },
  a: { lynxFactory: 'text' },
  button: { lynxFactory: 'view' },
  img: { lynxFactory: 'image' },
  input: { lynxFactory: 'element', rawTag: 'input' },
  ul: { lynxFactory: 'view' },
  ol: { lynxFactory: 'view' },
  li: { lynxFactory: 'view' },
  view: { lynxFactory: 'view' },
  text: { lynxFactory: 'text' },
  image: { lynxFactory: 'image' },
  'scroll-view': { lynxFactory: 'scrollView' },
});

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

function buildElement(htmlTag: string): ElementRef {
  const lower = htmlTag.toLowerCase();
  const info = TAG_MAP[lower];
  const compId = pageComponentId();
  if (info === undefined) {
    // OQ-S.2 permissive: unmapped HTML tag → view + data-shim-tag="X".
    const ref = __CreateView(compId);
    __SetAttribute(ref, 'data-shim-tag', lower);
    return ref;
  }
  switch (info.lynxFactory) {
    case 'view':
      return __CreateView(compId);
    case 'text':
      return __CreateText(compId);
    case 'image':
      return __CreateImage(compId);
    case 'scrollView':
      return __CreateScrollView(compId);
    case 'element':
      return __CreateElement(info.rawTag ?? lower, compId);
    default:
      return __CreateView(compId);
  }
}

/** Test-only: reset module-level state between tests. */
export function _resetDocumentForTesting(): void {
  bodyOverride = null;
  bodyChoiceLogged = false;
}

export interface ShimDocument {
  readonly documentElement: L1ReadOnlyElement;
  readonly body: L1ReadOnlyElement;
  createElement(tag: string): L1ReadOnlyElement;
  createTextNode(data: string): L1ReadOnlyText;
  createDocumentFragment(): ShimDocumentFragment;
  querySelector(selector: string): L1ReadOnlyElement | null;
  querySelectorAll(selector: string): readonly L1ReadOnlyElement[];
  getElementById(id: string): L1ReadOnlyElement | null;
  getElementsByClassName(name: string): readonly L1ReadOnlyElement[];
  getElementsByTagName(tag: string): readonly L1ReadOnlyElement[];
}

/**
 * Document stand-in. Sealed object — callers should not mutate it.
 */
export const document: ShimDocument = Object.freeze({
  /** Page-root wrapped as an Element. */
  get documentElement(): L1ReadOnlyElement {
    return wrapPapi(__GetPageElement()) as L1ReadOnlyElement;
  },

  /** See OQ-S.7 resolution in resolveBody(). */
  get body(): L1ReadOnlyElement {
    return wrapPapi(resolveBody()) as L1ReadOnlyElement;
  },

  createElement(tag: string): L1ReadOnlyElement {
    return wrapPapi(buildElement(tag)) as L1ReadOnlyElement;
  },

  createTextNode(data: string): L1ReadOnlyText {
    const ref = __CreateRawText(data);
    recordTextValue(ref, data);
    return new L1ReadOnlyText(ref);
  },

  createDocumentFragment(): ShimDocumentFragment {
    return _createDocumentFragment(pageComponentId());
  },

  querySelector(selector: string): L1ReadOnlyElement | null {
    const ref = __QuerySelector(__GetPageElement(), selector, {
      onlyCurrentComponent: false,
    });
    if (ref === undefined || ref === null) return null;
    const wrapped = wrapPapi(ref);
    return wrapped instanceof L1ReadOnlyElement ? wrapped : null;
  },

  querySelectorAll(selector: string): readonly L1ReadOnlyElement[] {
    const refs = __QuerySelectorAll(__GetPageElement(), selector, {
      onlyCurrentComponent: false,
    });
    const out: L1ReadOnlyElement[] = [];
    for (const r of refs) {
      const w = wrapPapi(r);
      if (w instanceof L1ReadOnlyElement) out.push(w);
    }
    return Object.freeze(out);
  },

  getElementById(id: string): L1ReadOnlyElement | null {
    // Spec id selector via querySelector; spec requires escaping but the
    // common case of a simple identifier is what we support today.
    return this.querySelector(`#${id}`);
  },

  getElementsByClassName(name: string): readonly L1ReadOnlyElement[] {
    return this.querySelectorAll(`.${name}`);
  },

  getElementsByTagName(tag: string): readonly L1ReadOnlyElement[] {
    return this.querySelectorAll(tag.toLowerCase());
  },
});
