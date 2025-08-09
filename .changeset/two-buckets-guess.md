---
"@lynx-js/react": patch
---

Improve `jsx_has_dynamic_key` detection with stricter checks

Previously, the dynamic key detection was overly broad and would incorrectly identify static string literals as dynamic keys, leading to unnecessary problems.

**Before:**

```tsx
// These were incorrectly flagged as dynamic keys
<text key={`hello`}>{hello}</text>     // Static template literal
<text key={'hello'}>{world}</text>     // Static string literal
```

**Now:**
The detection logic has been enhanced with stricter analysis. Previously flagged cases are now correctly identified as static keys.
