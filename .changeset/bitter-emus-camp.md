---
"@lynx-js/web-core": minor
---

**This is a breaking change**

## Architectural Upgrade: `web-core-wasm` replaces `web-core`

This release marks a major architectural upgrade for the web platform. The experimental, WASM-powered engine formerly known as `web-core-wasm` has been fully stabilized and merged into the main branch, completely replacing the previous pure JS/TS based `web-core` implementation. This consolidation massively improves execution performance and aligns the API boundaries of the Web platform directly with other native Lynx implementations.

### 🎉 Added Features

- **Core API Enhancements**: Successfully exposed and supported `__QuerySelector` and `__InvokeUIMethod` methods.
- **Security & CSP Compliance**: Added a `nonce` attribute to the iframe's `srcdoc` script execution, strengthening Content Security Policy (CSP) compliance.
- **`<lynx-view>` Parameter Enhancements**:
  - Added the `browser-config` attribute and property to `<lynx-view>`. Development environments can now supply a `BrowserConfig` object (e.g., configuring `pixelRatio`, `pixelWidth`, `pixelHeight`) allowing the `systemInfo` payload to be dynamically configured at the instance level.

### 🔄 Changed Features

- **Legacy JSON Backwards Compatibility**: Delivered comprehensive fixes and optimizations to deeply support legacy JSON output templates:
  - Added support for lazy loading execution mode (`lazy usage`).
  - Implemented the correct decoding and handling of `@keyframe` animation rules.
  - Rectified rule scoping matching including scoped CSS, root selectors, and type selectors.
- **Ecosystem Migration**: Updated testing and ecosystem applications (such as `web-explorer` and `shell-project`) to migrate away from obsolete fragmented dependencies. The new WASM architecture seamlessly integrates Element APIs and CSS directly inside the core client module, requiring a much simpler initialization footprint.

  **Before (Legacy `web-core` + `web-elements`):**
  ```typescript
  // Required multiple imports to assemble the environment
  import '@lynx-js/web-core/client';
  import type { LynxViewElement as LynxView } from '@lynx-js/web-core';

  // Had to manually import separate elements and their CSS
  import '@lynx-js/web-elements/index.css';
  import '@lynx-js/web-elements/all';

  const lynxView = document.createElement('lynx-view') as LynxView;
  // ...
  ```

  **After (New `web-core` unified architecture):**
  ```typescript
  // The new engine natively registers Web Components and injects fundamental CSS
  import '@lynx-js/web-core/client';
  import type { LynxViewElement as LynxView } from '@lynx-js/web-core/client';

  const lynxView = document.createElement('lynx-view') as LynxView;
  // ...
  ```
  _(Applications can now drop `@lynx-js/web-elements` entirely from their `package.json` dependencies)._
- **Dependency & Boot Sequence Improvements**: Re-architected module loading pathways. Promoted `wasm-feature-detect` directly to a core dependency, and hardened the web worker count initialization assertions.
- **Initialization Optimizations**: Converted `SERVER_IN_SHADOW_CSS` initialization bounds to use compilation-time constant expressions for better optimization.

### 🗑️ Deleted Features & Structural Deprecations

- **`<lynx-view>` Parameter Removals**:
  - Removed the `thread-strategy` property and attribute. Historically, this permitted consumers to toggle between `'multi-thread'` and `'all-on-ui'` modes depending on how they wanted the background logic to be executed. The WASM-driven architecture enforces a consolidated concurrency model, deprecating this `<lynx-view>` attribute entirely.
  - Removed the `overrideLynxTagToHTMLTagMap` property/attribute. HTML tag overriding mechanism has been deprecated in the new engine.
  - Removed the `customTemplateLoader` property handler from `<lynx-view>`.
  - Removed the `inject-head-links` property and attribute (`injectHeadLinks`), which previously was used to automatically inject `<link rel="stylesheet">` tags from the document head into the `lynx-view` shadow root.
- **Fragmented Packages Removal**: The new cohesive WASM architecture native to `@lynx-js/web-core` handles cross-thread communication, worker boundaries, and rendering loops uniformly. Consequently, multiple obsolete packages have been completely removed from the workspace:
  - `@lynx-js/web-mainthread-apis`
  - `@lynx-js/web-worker-runtime`
  - `@lynx-js/web-core-server`
  - `@lynx-js/web-core-wasm-e2e` (transitioned into standard test suites)
