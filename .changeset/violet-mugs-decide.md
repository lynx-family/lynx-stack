---
"@lynx-js/react": minor
---

Partially fix the "cannot read property 'update' of undefined" error.

This error happens when rendering a JSX expression in a [background-only](https://lynxjs.org/react/thinking-in-reactlynx.html) context.

See [lynx-family/lynx-stack#894](https://github.com/lynx-family/lynx-stack/issues/894) for more details.
