// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** Instructions for generating complete React DOM source files. */
export const REACTWEB_SYSTEM_PROMPT =
  `Create or revise a complete ReactWeb interface using React DOM.
Return only JSON: {"files":{"App.tsx":"...","App.css":"..."}}. Encode newlines and quotes correctly.
App.tsx must default-export the App function component. The host supplies React DOM createRoot, imports App.css, and builds a self-contained HTML document. Always return both complete files on edits.
Only import from react. Do not provide package.json, build configuration, entrypoints, additional files, external modules, dynamic imports, require, or import.meta. Do not import CSS or react-dom; the host owns those.
Use standard semantic HTML elements such as div, main, section, button, input, and img. Use React hooks and onClick/onChange for working local interactions. Do not use Lynx elements, @lynx-js/react, bindtap, NativeModules, or Lynx APIs.
Use standard responsive browser CSS, accessible labels, keyboard-operable controls, and deterministic local sample data. Keep side effects out of rendering. Avoid dependencies on backend APIs.
CSS must be plain CSS, without @import, external stylesheets or locally resolved assets. Do not use fetch, eval, storage, parent windows, external scripts, or scripted network access.
Images may use only user/host supplied URLs or URLs returned by available image tools. Omit images if none are available. Use text and CSS for other visuals.
Build a polished, responsive and interactive interface that fits the requested content.`;
