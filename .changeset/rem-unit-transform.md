---
"@lynx-js/web-core": patch
---

feat(web-core): add support for configurable rem unit transform

- **Description**: Added a new configuration option `transformREM` (also exposed as `transform_rem` on the Rust layer) to the Web Core renderer. When enabled, it recursively converts static `rem` unit values in your styles into dynamic CSS custom properties (`calc(VALUE * var(--rem-unit))`) during template decoding and evaluation. This enables developers to implement responsive font scaling and layout sizing dynamically on the client side simply by modifying the root CSS variable `--rem-unit`.

- **Usage**:
  You can enable this feature when working with `LynxView` by setting `transformREM` to `true`, or directly as an HTML attribute `transform-rem`:

  ```html
  <lynx-view url="https://example.com/template.js" transform-rem="true"></lynx-view>
  ```

  ```javascript
  const lynxView = document.createElement('lynx-view');
  lynxView.transformREM = true;
  ```

  With this enabled, a CSS declaration like `font-size: 1.5rem;` is transparently evaluated as `font-size: calc(1.5 * var(--rem-unit));` by the runtime engine.
