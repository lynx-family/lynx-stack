// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rpc } from '@lynx-js/web-worker-rpc';
import { addFontEndpoint } from '../../endpoints.js';
import type { LynxViewInstance } from '../LynxViewInstance.js';

/**
 * The fonts `lynx.addFont()` has already registered, per document.
 *
 * `document.fonts` outlives the card that filled it: a `lynx.reload()` (or a
 * second card on the page) re-runs the card's `lynx.addFont()` calls against
 * the same document, so without this the same font face would be appended
 * again on every reload. Keyed by descriptor, so a genuinely different `src`
 * for the same family still registers.
 */
const registeredFonts: WeakMap<Document, Map<string, FontFace>> = new WeakMap();

export function registerAddFontHandler(
  rpc: Rpc,
  lynxViewInstance: LynxViewInstance,
) {
  rpc.registerHandler(
    addFontEndpoint,
    (fontFace) => {
      // The background thread has no DOM, and `document.fonts` isn't scoped
      // per shadow root, so the font is registered against the lynx-view's
      // owner document (the host page) — the same document that actually
      // renders the elements in its shadow tree.
      const doc = lynxViewInstance.rootDom.ownerDocument;
      const family = fontFace['font-family'];
      const src = fontFace['src'];
      const key = `${family}\0${src}`;

      let documentFonts = registeredFonts.get(doc);
      if (!documentFonts) {
        documentFonts = new Map();
        registeredFonts.set(doc, documentFonts);
      }

      let fontFaceObject = documentFonts.get(key);
      if (!fontFaceObject) {
        // Build the `FontFace` from the owner document's own realm: a card
        // rendered inside an iframe must not hand that document a constructor
        // from another window.
        const FontFaceCtor = doc.defaultView?.FontFace ?? FontFace;
        fontFaceObject = new FontFaceCtor(family, src);
        doc.fonts.add(fontFaceObject);
        documentFonts.set(key, fontFaceObject);
      }

      // Resolve only once the font is usable, so the background thread's
      // `callback` isn't called on a font the page still can't render with.
      // A failed load resolves too — a dangling callback would be worse than
      // one that fires for a font that turned out to be unreachable.
      return fontFaceObject.load().then(
        () => {},
        (error) => {
          console.error(`[lynx-web] lynx.addFont failed to load`, error);
        },
      );
    },
  );
}
