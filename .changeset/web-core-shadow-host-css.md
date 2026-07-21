---
"@lynx-js/web-core": patch
---

Include the `<lynx-view>` host and page baseline styles in its shadow root so client rendering and declarative Shadow DOM SSR do not depend on the outer document stylesheet.
