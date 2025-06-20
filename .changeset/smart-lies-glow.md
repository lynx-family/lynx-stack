---
"@lynx-js/react": minor
---

Allow some `<list-item/>`s to be defer and render at background thread.

Using the following syntax:

```diff
<list>
-  <list-item item-key="...">
+  <list-item item-key="..." defer>
      <SomeHeavyComponent />
  </list-item>
</list>
```

You should render your heavyweight components with `defer` attribute to avoid blocking the main thread.
