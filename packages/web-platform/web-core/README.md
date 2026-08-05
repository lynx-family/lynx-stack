# @lynx-js/web-core

Lynx3 Web Platform runtime core

## Usage

### use an open CDN

#### unpkg

```html
<script src="https://app.unpkg.com/@lynx-js/web-core/files/dist/client_prod/static/js/client.js" type="module"></script>
<link rel="stylesheet" href="https://app.unpkg.com/@lynx-js/web-core/files/dist/client_prod/static/css/client.css">
```

#### jsdelivr

```html
<script src="https://cdn.jsdelivr.net/npm/@lynx-js/web-core/dist/client_prod/static/js/client.js" type="module"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@lynx-js/web-core/dist/client_prod/static/css/client.css">
```

### bundle with your project

```javascript
import '@lynx-js/web-core/client';

document.body.innerHTML = `
<lynx-view 
  style="height:100vh; width:100vw;" 
  url="http://localhost:3000/main/card.xml"
>
</lynx-view>`;
```

### Lynx markup artifacts

In addition to binary and JSON templates, `<lynx-view>` can load a `.xml`
artifact using the Lynx-specific markup format:

```xml
<!DOCTYPE lynx>
<style>
  /* css content */
</style>
<script main-thread>
  /* main thread code */
</script>
<script background>
  /* background thread code */
</script>
```

Main-thread and background scripts can listen for page disposal through the
engine environment:

```js
const engine = lynx.getEngine();

function cleanup() {
  engine.removeEventListener('__DestroyLifetime', cleanup);
}

engine.addEventListener('__DestroyLifetime', cleanup);
```

## Document

See our website for more information.
