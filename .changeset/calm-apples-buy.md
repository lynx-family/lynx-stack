---
"@lynx-js/react": patch
---

Add support for batch rendering in `<list>` with async resolution of sub-tree properties and element trees.

Use the `experimental-batch-render-strategy` attribute of `<list>`:

```tsx
<list
  /**
   * Batch render strategy:
   * 0: (Default) Disabled - No batch rendering
   * 1: Basic - Only batch rendering enabled
   * 2: Property Resolution - Batch render with async property resolution for list item subtree
   * 3: Full Resolution - Batch render with async property and element tree resolution for list item subtree
   */
  experimental-batch-render-strategy={3}
>
</list>;
```
