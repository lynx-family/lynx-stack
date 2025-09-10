---
"@lynx-js/react-rsbuild-plugin": minor
"@lynx-js/rspeedy": minor
---

feat(web-platform): use same chunk loading and chunk format with iOS/Android

**Breaking Change, you will need to upgrade your web platform version**

Before this commit, the environment.web output has its own chunk format.

After this commit, we migrate those into the format running on iOS/Android.

The new format has such special features:

- use lynx.requireModuleAsync/lynx.requireModule to load Javascript Chunk
- be added a IIFE function wrapper for bts chunks
- mts chunk cannot be splitted
- some global variables, is exported by the IIFE wrapper
