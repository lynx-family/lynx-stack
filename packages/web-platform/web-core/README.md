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

## Event coordinates

Mouse events and touch points use `pageX`/`pageY` for coordinates relative to
the containing `lynx-view`, matching native Lynx. These coordinates share the
origin and rendered scale of the `boundingClientRect` UI method and of
`detail.x`/`detail.y` on touch and tap events. `clientX`/`clientY` remain relative
to the browser viewport. In an iframe, that viewport belongs to the iframe's
document.

Before this correction, Web `pageX`/`pageY` were relative to the browser
document. Code that needs document coordinates should read the original DOM
event in its embedding host or add that document's scroll offset to
`clientX`/`clientY`.

For compatibility, Web mouse `x`/`y` and per-touch `x`/`y` retain their existing
`lynx-view`-relative meaning. They do not yet match native Lynx's target-relative
`x`/`y`. Use `pageX`/`pageY`, or touch/tap `detail.x`/`detail.y`, when combining an
event position with LynxView-relative bounds. Combining `clientX`/`clientY`
with those bounds works only when the viewport and LynxView origins coincide.

## Document

See our website for more information.
