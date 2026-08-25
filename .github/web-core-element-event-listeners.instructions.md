---
applyTo: "packages/web-platform/web-core/{src,ts,tests}/**/*"
---

Invoke function callbacks registered through `__AddEventListener` one microtask after delegated event dispatch. Queue them at the `runElementClosure` bridge in capture/catch/bubble order, and retain each queued callback's own target and current-target data so later dispatch iterations cannot overwrite what it observes.
