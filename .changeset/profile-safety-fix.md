---
'@lynx-js/react': patch
---

Add safety checks for compilation macros to prevent runtime errors when they are undefined.

Replaces direct usage of `__PROFILE__`, `__MAIN_THREAD__`, `__BACKGROUND__` with `typeof` checks.

This improves robustness by checking variable existence before access, preventing runtime errors in environments where compilation macros are not defined.
