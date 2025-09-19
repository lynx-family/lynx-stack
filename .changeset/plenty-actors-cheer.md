---
"@lynx-js/react-rsbuild-plugin": minor
---

feat(web-platform): migrate environment.web output format and update tests for runtime wrapper plugin

**Breaking Change, you will need to upgrade your web platform version**

Before this commit, the environment.web output has its own chunk format.

After this commit, we migrate those into the format running on iOS/Android.

The new format has such special features:

- some global variables, is exported by the IIFE wrapper
