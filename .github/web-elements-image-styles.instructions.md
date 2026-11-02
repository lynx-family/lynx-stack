---
applyTo: "packages/web-platform/web-elements/src/elements/XImage/**"
---

`x-image[auto-size]` uses `display: contents`, so its shadow image must explicitly inherit non-inherited rendering properties such as `object-fit` from the host. Preserve this inheritance for both direct style updates and the `aspectFit`/`aspectFill` mode rules, and test changes with `auto-size` enabled and toggled.
