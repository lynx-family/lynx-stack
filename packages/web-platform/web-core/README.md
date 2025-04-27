# @lynx-js/web-core

Lynx3 Web Platform runtime core

## Usage

```javascript
import '@lynx-js/web-core';
import '@lynx-js/web-core/index.css';

document.body.innerHTML = `
<lynx-view 
  style="height:100vh; width:100vw;" 
  url="http://localhost:3000/main/main-thread.js"
>
</lynx-view>`;
```

If you use Lynx elements (view, text, image, etc.), you need to import `@lynx-js/web-elements`:

```javascript
import '@lynx-js/web-core';
import '@lynx-js/web-core/index.css';
import '@lynx-js/web-elements/all';
import '@lynx-js/web-elements/index.css';

document.body.innerHTML = `
<lynx-view 
  style="height:100vh; width:100vw;" 
  url="http://localhost:3000/main/main-thread.js"
>
</lynx-view>`;
```

## Document

See our website for more information.
