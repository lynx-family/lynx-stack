---
"@lynx-js/template-webpack-plugin": patch
---

feat(web): enable web binary template by default

The default encoding format for the web platform template has been changed from JSON to Binary.

**Benefits for developers:**

- **Smaller output size:** Binary templates are more compact than JSON strings, reducing the final bundle size.
- **Faster load performance:** Binary templates parse faster than JSON in the runtime, improving the time-to-interactive for web applications.

**How to turn off this feature:**
If you encounter any issues with the new binary template format, you can revert to the previous JSON format by setting the environment variable `EXPERIMENTAL_USE_WEB_BINARY_TEMPLATE` to `'false'` or `'0'` before running your build commands. For example:
`EXPERIMENTAL_USE_WEB_BINARY_TEMPLATE=false rspeedy build`

**Upgrade to `@lynx-js/web-core@0.20.2` could support the new output format**

See [`@lynx-js/web-core` Changelog](https://lynx-stack.dev/changelog/lynx-js--web-core)
