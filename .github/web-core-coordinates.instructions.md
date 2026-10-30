---
applyTo: "packages/web-platform/web-core/{ts,tests}/**,packages/web-platform/web-core-e2e/tests/**"
---

Normalize Lynx event `pageX`/`pageY` from DOM `clientX`/`clientY` minus the containing LynxView's viewport origin. DOM `pageX`/`pageY` include document scrolling and cannot be mixed with the host's viewport bounds. Keep `clientX`/`clientY` viewport-relative and use the same origin and rendered scale as the Lynx `boundingClientRect` UI method for view-relative event coordinates.

Keep Web `x`/`y` aliases view-relative for compatibility until a separate migration explicitly changes them to native target-relative semantics. Tests must distinguish client, browser document, view, and target coordinates; an iframe with its LynxView at the origin can hide a coordinate-space mismatch.
