---
"create-rspeedy": patch
---

Changing filename of index.jsx to index.js because rspeedy requires index.js. Then edit index.js import statement to make it import App.jsx instead of App.js since App.jsx is present in the template. This resolves "Module not found" error.
