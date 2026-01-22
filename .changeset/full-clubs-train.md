---
"@lynx-js/react": patch
---

When `runWithForce` is called, we should increment `vnode._original` to make sure the component is re-rendered. This can fix the issue that the component is not re-rendered when updateGlobalProps is called and the root vnode is not a component vnode.
