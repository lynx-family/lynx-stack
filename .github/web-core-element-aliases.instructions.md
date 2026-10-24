---
applyTo: "packages/web-platform/web-core/**/*"
---

Keep Lynx-to-HTML element aliases synchronized between `ts/constants.ts` for CSR and SSR element creation and `src/constants.rs` for binary CSS type-selector decoding.
When an alias can appear in legacy JSON CSS as `[lynx-tag="..."]`, make `ts/client/decodeWorker/cssLoader.ts` resolve it through the shared TypeScript tag map before applying the generic `x-` prefix fallback.
Because multiple Lynx names may map to one HTML custom element, keep the stable reverse mapping explicit and shared by CSR and SSR instead of relying on forward-map iteration order.
Cover alias changes with CSR, SSR, binary CSS, and legacy JSON CSS tests.
