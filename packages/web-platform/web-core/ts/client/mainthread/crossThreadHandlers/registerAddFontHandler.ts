// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rpc } from '@lynx-js/web-worker-rpc';
import { addFontEndpoint } from '../../endpoints.js';
import type { LynxViewInstance } from '../LynxViewInstance.js';

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
      const FontFaceCtor = doc.defaultView!.FontFace;
      const fontFaceObject = new FontFaceCtor(
        fontFace['font-family'],
        fontFace['src'],
      );
      doc.fonts.add(fontFaceObject);
      return fontFaceObject.load().then(
        () => {},
        (error) => {
          console.error(`[lynx-web] lynx.addFont failed to load`, error);
        },
      );
    },
  );
}
