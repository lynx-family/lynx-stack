---
"@lynx-js/web-core": patch
---

feat: allow user to implement custom template load function

```js
lynxView.customTemplateLoader = (url) => {
  return (await (await fetch(url, {
    method: 'GET',
  })).json());
};
```
