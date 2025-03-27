# @lynx-js/web-elements

It provides the custom-element implementation of Lynx Elements in Web.

So far, support compared to Lynx Elements on the client:

| Elements       | Whether support | Details                                                                        |
| -------------- | --------------- | ------------------------------------------------------------------------------ |
| Elements       |                 |                                                                                |
| canvas         | ❌              | No                                                                             |
| image          | ✅              | Full Support                                                                   |
| list           | ✅              | list-type with single and flow are available, and waterfall is being supported |
| scroll-view    | ✅              | Full Support                                                                   |
| text           | ✅              | Full Support                                                                   |
| view           | ✅              | Full Support                                                                   |
| X-Elements     |                 |                                                                                |
| svg            | ✅              | Full Support                                                                   |
| x-blur-view    | ✅              | Full Support                                                                   |
| x-input        | ✅              | Full Support                                                                   |
| x-textarea     | ✅              | Full Support                                                                   |
| x-swiper       | ✅              | Full Support                                                                   |
| x-viewpager-ng | ✅              | Full Support                                                                   |
| x-foldview-ng  | ✅              | Full Support                                                                   |
| x-refresh-view | ✅              | Full Support                                                                   |
| x-overlay-ng   | ✅              | Full Support                                                                   |
| x-audio-tt     | ✅              | Full Support                                                                   |

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

## Document

See our website for more information.
