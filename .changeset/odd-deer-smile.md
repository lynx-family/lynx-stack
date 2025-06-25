---
"@lynx-js/template-webpack-plugin": patch
---

feat: `::placeholder` will be compiled to `part(input)::placeholder`, which means you can use pseudo-element CSS to add placeholder styles to input and textarea.

```
// before
<input placeholder-color='red' placeholder-font-weight='bold' placeholder-font-size='20px'>

// after
<input>

input::placeholder {
  color: red;
  font-weight: bold;
  font-size: 20px;
}
```
