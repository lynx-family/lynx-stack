---
"@lynx-js/react-rsbuild-plugin": patch
---

fix(web-platform): remove special lightning css&chunk split settings for web

the following css file now have the same behavior on web platform with iOS/Android

```css
.some_rules{
  
}

@import "cssFile.css"
```
