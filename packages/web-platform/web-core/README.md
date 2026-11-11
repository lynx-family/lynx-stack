# @lynx-js/web-core

Lynx3 Web Platform runtime core

## Usage

### use an open CDN

#### unpkg

```html
<script src="https://unpkg.com/@lynx-js/web-core/dist/client_prod/static/js/client.js" type="module"></script>
<link rel="stylesheet" href="https://unpkg.com/@lynx-js/web-core/dist/client_prod/static/css/client.css">
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
  url="http://localhost:3000/main.web.bundle"
>
</lynx-view>`;
```

### Enable mouse-drag scrolling

To make `<scroll-view>` respond to mouse dragging like a touchscreen, import
the optional plugin before the client:

```javascript
import '@lynx-js/web-core/plugins/scroll-view-mouse-drag';
import '@lynx-js/web-core/client';
```

The plugin only changes `<scroll-view>` and leaves native touch scrolling
unchanged.

To enable `<animax-view>`, install `@lynx-js/animax` and import the opt-in
side-effect entry:

```javascript
import '@lynx-js/web-core/animax';
```

### Resolve image resources

Set `resolveResource` before loading a view to resolve `<image>` and
`<filter-image>` sources and placeholders against your asset directory:

```typescript
import type { LynxViewElement } from '@lynx-js/web-core/client';
import '@lynx-js/web-core/client';

const view = document.createElement('lynx-view') as LynxViewElement;
view.style.cssText = 'height: 100vh; width: 100vw';
view.resolveResource = (src) =>
  new URL(src, 'https://example.com/assets/').href;
view.url = 'https://example.com/main.web.bundle';
document.body.append(view);
```

The hook runs synchronously for image loads, placeholder preloads, and error
fallbacks. It receives the original `src` or `placeholder` value; the element's
attributes remain unchanged. Images resolve their URLs again when connected or
moved to another shadow-root host. Changing the hook does not reload images that
are already connected. Without a hook, URLs are used unchanged. This hook does
not resolve CSS URLs or bundle URLs.

## Document

See our website for more information.
