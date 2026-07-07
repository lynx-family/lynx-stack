---
"@lynx-js/genui": patch
---

Move the Material Icons `@font-face` out of `a2ui/styles/theme.css` into a separate `a2ui/styles/material-icons.css`, imported only by the two stylesheets that render the font (`catalog/Icon.css`, `catalog/DateTimeInput.css`).

`theme.css` was 1,813,181 bytes, 99.9% of which was one base64 TTF data URI — and every `catalog/*.css` starts with `@import "../theme.css"`, so registering ANY catalog component shipped the 1.8 MB font even when no icon glyph was used (the CLI starter template pays this cost while registering no icon-bearing component). After this change `theme.css` is ~1.9 KB of theme tokens; apps that register `Icon` or `DateTimeInput` still get the font automatically via their catalog CSS, pixel-identical.

The font stays an embedded TTF (Lynx native cannot parse woff2 — see #2711); it just no longer rides along with unrelated components. Custom-catalog authors who use `var(--a2ui-icon-font-family)` without registering a built-in icon component can opt back in with `import '@lynx-js/genui/a2ui/styles/material-icons.css'` (newly exported).
