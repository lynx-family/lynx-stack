---
applyTo: "packages/rspeedy/plugin-config/**/*"
---

When upgrading `@lynx-js/type-config`, use the existing validation and forwarding tests for fields that follow the shared configuration path. Add a field-specific test when the plugin handles that field differently or when the test covers a regression the shared tests would miss.
