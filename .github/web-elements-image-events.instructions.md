---
applyTo: "packages/web-platform/web-elements/src/elements/{XImage,XText}/**"
---

Keep `x-image` and `inline-image` load event forwarding in the shared `ImageEvents` reactive class. Image loads can complete while the host is in a detached fragment, so preserve dimensions when the inner image fires `load` and defer host dispatch until `isConnected` is true. Flush pending events from the reactive class's `connectedCallback`, removing each event before dispatch so reconnecting cannot replay it.
