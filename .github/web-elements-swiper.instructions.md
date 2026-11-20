---
applyTo: "packages/web-platform/web-elements/src/elements/XSwiper/*.css"
---

Keep the experimental specificity increase for swiper item positioning confined to the `position: relative` rule. Scoped class selectors such as `.swiper-item:where([l-css-id="1027170"]):not([l-e-name])` have specificity `(0,2,0)` because `:where()` contributes zero specificity; the positioning rule must exceed this without depending on a generated CSS ID.
