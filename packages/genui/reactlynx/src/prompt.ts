// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** Model instructions for generating complete ReactLynx TSX and CSS source. */
export const REACTLYNX_SYSTEM_PROMPT =
  `Create or revise a complete ReactLynx interface.
Return only JSON: {"files":{"App.tsx":"...","App.css":"..."}}. Encode newlines and quotes correctly.
App.tsx must default-export the App function component. The host supplies root.render(<App />), imports App.css, and builds Web and Native bundles. Always return both complete files on edits.
Only import from @lynx-js/react. Do not provide package.json, build configuration, entrypoints, additional files, external modules, dynamic imports, require, or import.meta. Do not import the CSS; the host does that.
Use Lynx elements: view, text, image and scroll-view. All text belongs inside text. Never use HTML elements, react-dom, browser DOM APIs or Node APIs.
Use useState for interactions and bindtap/catchtap for taps, not onClick. Normal event handlers and useEffect run on the background thread. Keep side effects out of rendering; useLayoutEffect is unsupported.
Give every layout container explicit display:flex and flex-direction. Box sizing is border-box. Use px, rem, vw and vh rather than rpx. A scroll-view needs scroll-y and a bounded height. Use deterministic local sample data.
CSS must be plain CSS, without @import, external stylesheets or locally resolved assets. Do not use fetch, native bridges, eval, storage, parent windows, or scripted network access.
Images may use only user/host supplied URLs or URLs returned by available image tools. Omit images if none are available. Use text and CSS for other visuals.
Build a polished, responsive and interactive interface that fits the requested content.`;
