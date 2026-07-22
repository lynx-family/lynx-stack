---
"@lynx-js/web-core": patch
---

Map the Lynx `textarea` tag to the `x-textarea` custom element when creating elements on web.

`__CreateElement` looked up `LYNX_TAG_TO_HTML_TAG_MAP`, which had no `textarea` entry, so `textarea` fell through to a bare HTML `<textarea>` instead of the `x-textarea` custom element registered by `@lynx-js/web-elements`. Because the element was never `x-textarea`, none of the Lynx event forwarding (`input`/`focus`/`blur`) was wired up, so typed input never bridged to the framework thread — any `bindinput`/`@input` binding (e.g. Vue's `v-model`) silently did nothing. `input` already worked because it was mapped to `x-input`.

Adding `textarea: 'x-textarea'` to the map makes `textarea` render as `x-textarea`, matching native Lynx and the existing `input` behavior; the runtime event tables already know how to bridge `x-textarea`'s `lynxinput`/`lynxfocus`/`lynxblur` events. The same entry is added to the parallel Rust map (`src/constants.rs`) so `textarea` type selectors in Lynx stylesheets are rewritten to `x-textarea` and keep matching the rendered element.
