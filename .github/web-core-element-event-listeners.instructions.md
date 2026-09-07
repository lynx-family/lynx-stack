---
applyTo: "packages/web-platform/web-core/{src,ts,tests}/**/*"
---

Invoke function callbacks registered through `__AddEventListener` one microtask after delegated event dispatch. Queue them at the `runElementClosure` bridge in capture/catch/bubble order, and retain each queued callback's own target and current-target data so later dispatch iterations cannot overwrite what it observes.

Events whose Web Components attach native listeners through `enableEvent` must be included in `ELEMENT_REACTIVE_EVENTS`; otherwise ReactLynx stores the handler but never invokes the component's event enablement hook.

Reactive event registration can arrive before its Web Component is upgraded. Preserve the `enableEvent` and `disableEvent` call order through `customElements.whenDefined()` instead of dropping optional method calls made before the definition loads.
