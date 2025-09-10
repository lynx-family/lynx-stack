---
"@lynx-js/web-elements-template": patch
"@lynx-js/web-elements": patch
---

fix: 1. svg use image tag to render, to differentiate background-image styles

1. use blob instead of raw data-uri

> Not using data-uri(data:image/svg+xml;utf8,${props.content})
> since it has follow limitations:
>
> < and > must be encoded to %3C and %3E.
> Double quotes must be converted to single quotes.
> Colors must use a non-hex format because # will not work inside data-uri.
> See: https://codepen.io/zvuc/pen/BWNLJL
> Instead, we use modern Blob API to create SVG URL that have the same support
