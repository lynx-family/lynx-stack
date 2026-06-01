---
"@lynx-js/react": patch
---

Fix `addComponentElement` compat transforms so explicit `removeComponentElement={true}` is honored consistently even when it appears before a JSX spread like `{...props}`.

Previously, the compat transform could short-circuit while scanning opening attributes and treat:

```jsx
<Component removeComponentElement={true} {...props} />;
```

differently from:

```jsx
<Component {...props} removeComponentElement={true} />;
```

The transform now collects the full opening-attribute state first, so both prop orders compile the same way in normal and `compilerOnly` modes.
