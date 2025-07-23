---
"@lynx-js/react": patch
---

Add profile in production build:

1. `diff:__COMPONENT_NAME__`: how long ReactLynx diff took.
2. `render:__COMPONENT_NAME__`: how long your render function took.
3. `setState`: an instant trace event, indicate when your setState was called.

NOTE: `__COMPONENT_NAME__` may be unreadable when minified, setting `displayName` may help.
