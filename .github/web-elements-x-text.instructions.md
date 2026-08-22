---
applyTo: "packages/web-platform/web-elements/src/elements/XText/**"
---

When updating `x-text` truncation measurement, keep text-like inline containers such as `x-text`, `inline-text`, `raw-text`, and `lynx-wrapper` transparent so their descendants are measured with DFS. Treat `x-view` as one atomic inline box; measuring both the `x-view` and its child boxes can double-count inline views and make one visual line look like multiple lines.
Keep text `layout` detail lazy so main-thread consumers only pay for the fields they read. Repeated reads must reuse the cached measurement, and array-like metadata such as `lines.length` must not force eager event materialization. Use the content `#inner-box` rectangle as the measurement boundary; the host rectangle includes padding and borders and produces incorrect line boundaries.
