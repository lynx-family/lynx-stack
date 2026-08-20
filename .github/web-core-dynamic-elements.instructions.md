---
applyTo: "packages/web-platform/web-core/ts/client/{webElementsDynamicLoader.ts,mainthread/{LynxViewInstance.ts,elementAPIs/createElementAPI.ts}},packages/web-platform/web-core/tests/*dynamic-loader*"
---

When providing a built-in Web implementation for a Lynx custom element, register a tag-specific dynamic import in `webElementsDynamicLoader.ts` and let the generic `__CreateElement` path notify `LynxViewInstance.loadUnknownElement`. Cache concurrent loads per tag, verify that the imported module registered the custom element, and preserve the `loadUnknownElement` event as the extension point for tags without a built-in loader.
