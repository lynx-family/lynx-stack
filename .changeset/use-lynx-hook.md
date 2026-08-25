---
"@lynx-js/react": minor
---

Add the `useLynx()` hook, which reads the `lynx` of the page a component is
rendering in. Code in a chunk shared by several cards must not capture the
module-scope `lynx`: that one belongs to whichever card evaluated the chunk
and stops working when that card is destroyed.

Falls back to the module-scope `lynx` when the tree has no render context, so
single-page cards are unaffected.
