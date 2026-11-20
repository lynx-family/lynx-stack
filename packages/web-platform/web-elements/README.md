# @lynx-js/web-elements

It provides the custom-element implementation of Lynx Elements in Web.

So far, support compared to Lynx Elements on the client:

| Elements       | Whether support | Details      |
| -------------- | --------------- | ------------ |
| Elements       |                 |              |
| image          | ✅              | Full Support |
| list           | ✅              | Full Support |
| scroll-view    | ✅              | Full Support |
| text           | ✅              | Full Support |
| view           | ✅              | Full Support |
| X-Elements     |                 |              |
| svg            | ✅              | Full Support |
| x-blur-view    | ✅              | Full Support |
| x-input        | ✅              | Full Support |
| x-textarea     | ✅              | Full Support |
| x-swiper       | ✅              | Full Support |
| x-viewpager-ng | ✅              | Full Support |
| x-foldview-ng  | ✅              | Full Support |
| x-refresh-view | ✅              | Full Support |
| x-overlay-ng   | ✅              | Full Support |
| x-audio-tt     | ✅              | Full Support |

## Usage

```javascript
import '@lynx-js/web-elements/all';
import '@lynx-js/web-elements/index.css';

document.body.innerHTML = `
<x-text style="font-size: 24px;font-weight: bold">
  Hello lynx.
</x-text>
`;
```

### Text whitespace

Text content follows native Lynx semantics: ordinary spaces, repeated spaces, and line breaks are preserved rather than collapsed using HTML defaults. A space-only text line remains measurable, including when content is supplied through `raw-text`, direct text children, or the `text` attribute. Use layout properties for spacing between components; do not use whitespace text as a layout spacer.

### Mouse-drag scrolling

To make `<scroll-view>` respond to mouse dragging like a touchscreen, load
the optional plugin before registering the elements:

```javascript
import '@lynx-js/web-elements/plugins/scroll-view-mouse-drag';
import '@lynx-js/web-elements/all';
import '@lynx-js/web-elements/index.css';
```

The plugin only changes `<scroll-view>` and leaves native touch scrolling
unchanged.

## Document

See our website for more information.
