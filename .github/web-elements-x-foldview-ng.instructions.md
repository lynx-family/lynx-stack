---
applyTo: "packages/web-platform/web-elements/src/elements/XFoldViewNg/**"
---

`x-foldview-ng` has two layout paths, selected by the same feature query in CSS and in script: `(top: anchor(--a bottom)) and (anchor-scope: all)`. Keep the `@supports` rule in `x-foldview-ng.css` and `supportsAnchorPositioning` in `XFoldviewNg.ts` in sync; a browser must never take one path in CSS and the other in script.

On the anchor path the slot is `position: absolute !important` and anchored to the bottom of the header, and no script measures anything. `anchor()` and `anchor-size()` only resolve on absolutely positioned boxes, so the slot cannot stay a flex item there; do not try to put the anchor functions on a relatively positioned slot, they compute to their fallback. Because the header is itself absolutely positioned in the same containing block, it is only an acceptable anchor when it precedes the slot in the document.

Since the slot is out of flow, its flex factors are emulated in CSS from the `--flex-grow` and `--flex-shrink` custom properties the web style transformer writes; the `--flex` shorthand cannot be read this way. `scrollableLength` is `scrollHeight - clientHeight` on this path.

On the fallback path the slot stays in flow and the `ResizeObserver` in `XFoldviewNg.ts` writes `style.top`. Tests must hold on both paths, so assert geometry such as `offsetTop` rather than the inline `top`.

Playwright screenshots for this package are Linux-only; verify layout changes locally by measuring geometry in a browser instead of running the screenshot suite.
