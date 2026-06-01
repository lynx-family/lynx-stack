---
"@lynx-js/react": patch
---

Rename the `bundle-url` element attribute to `lazy-bundle-url`.

The attribute set on lazy bundle border elements (when a child belongs to a different lazy bundle entry than its parent) is renamed from `bundle-url` to `lazy-bundle-url` to make its purpose explicit.
