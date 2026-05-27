---
applyTo: "packages/web-platform/web-elements/src/**/*.ts"
---

When maintaining `@Component`-decorated web elements, do not assume static fields on the original decorator target are initialized before class decorator logic runs. Rsbuild/Rspack/SWC decorator transforms may apply static field initializers to the decorated/replacement class instead. Runtime component helpers that need static metadata, such as `notToFilterFalseAttributes`, should read it from the final custom element class used for registration.
