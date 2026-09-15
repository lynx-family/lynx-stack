---
applyTo: "packages/web-platform/web-core/ts/client/mainthread/LynxView.ts,packages/web-platform/web-core/tests/lynx-view.spec.ts"
---

Preserve properties assigned to an unresolved `<lynx-view>` before custom element upgrade. Use a private backing field with public accessors and replay pre-upgrade own properties through `#upgradeProperty` before rendering. Keep public properties discoverable with the `in` operator on fresh elements for framework property detection. Cover both connected elements upgraded by `customElements.define` and detached elements upgraded by `customElements.upgrade` in regression tests.
