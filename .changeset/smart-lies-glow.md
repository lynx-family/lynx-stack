---
"@lynx-js/react": minor
---

Allow some `<list-item/>`s to be deferred and rendered in the background thread.

Use the following syntax:

```diff
<list>
-  <list-item item-key="...">
+  <list-item item-key="..." defer>
      <SomeHeavyComponent />
  </list-item>
</list>
```

You should render your heavyweight components with the `defer` attribute to avoid blocking the main thread.
