---
"@lynx-js/web-elements": patch
---

Position `x-foldview-slot-ng` with CSS anchor positioning instead of script in browsers that support `anchor()` and `anchor-scope`. The slot is taken out of the flow and anchored below `x-foldview-header-ng`, so the header and the toolbar are no longer measured by a `ResizeObserver`. Other browsers keep the previous script-driven layout.

In the supporting browsers the slot no longer takes part in the flex layout of `x-foldview-ng`: it fills the area the toolbar leaves unless it has its own `height`, and it does not size an `x-foldview-ng` whose height is `auto`. `x-foldview-header-ng` has to precede `x-foldview-slot-ng` in the document. A slot wrapped in a `lynx-wrapper` is now placed below the header as well.
