---
"@lynx-js/web-core": patch
---

feat: The error event return value detail of lynx-view adds `sourceMap` value, the type is as follows:

```
CustomEvent<{
  error: Error;
  sourceMap: {
    offset: {
      line: number;
      col: number;
    };
  };
}>;
```

This is because web-core adds wrapper at runtime, which causes the stack offset to be different. Now you can calculate the real offset based on it.
