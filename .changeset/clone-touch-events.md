---
"@lynx-js/web-core": patch
---

Always clone touch event lists when creating cross-thread events so synthetic touch events only carry structured-clone-safe primitive fields.
