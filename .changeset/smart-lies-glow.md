---
"@lynx-js/react": minor
---

Allow some `<list-item/>`s to be deferred and render at background thread.

Using the following syntax:

```diff
<list>
-  <list-item item-key="...">
+  <list-item item-key="..." deferred>
      <SomeHeavyComponent />
  </list-item>
</list>
```

You should render your heavyweight components with `deferred` attribute to avoid blocking the main thread.
