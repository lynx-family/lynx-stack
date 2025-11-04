---
"@lynx-js/react": patch
---

During hydration, replace update with insert + remove for same-type `<list-item />` with different `item-key` so the Lynx Engine detects changes.

```html
Hydrate List B into List A:

List A:
<list>
  <list-item item-key="a">hello</list-item>
  <list-item item-key="a">world</list-item>
</list>

List B:
<list>
  <list-item item-key="a1">hello</list-item>
  <list-item item-key="a2">world</list-item>
</list>
```

Previously this case was hydrated as an update; it is now emitted as insert + remove to ensure SDK detection.
