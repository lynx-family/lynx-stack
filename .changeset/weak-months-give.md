---
"@lynx-js/react": patch
---

Avoid some unexpected `__SetAttribute` in hydrate when `undefined` is passed as a attribute value to intrinsic elements, for example:

```jsx
<image async-mode={undefined} />;
```
