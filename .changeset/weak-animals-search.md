---
'@lynx-js/react': patch
---

Add `animate` API in Main Thread Script(MTS), so you can now control a CSS animation imperatively

```
function startAnimation() {
  'main thread'
  const animation = ele.animate([
    { opacity: 0 },
    { opacity: 1 },
  ], {
    duration: 3000
  })

  animation.pause()
}
```
