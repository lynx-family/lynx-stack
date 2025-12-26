---
"@lynx-js/react-rsbuild-plugin": patch
---

Expose `LynxTemplatePlugin` to rsbuild API of key `Symbol.for('LynxTemplatePlugin')`. Usage:

```ts
const pluginThatUsesTemplateHooks = {
  name: 'pluginThatUsesTemplateHooks',
  setup(api) {
    const expose = api.useExposed(Symbol.for('LynxTemplatePlugin'));
    api.modifyBundlerChain(chain => {
      const PLUGIN_NAME = 'pluginThatUsesTemplateHooks';
      chain.plugin(PLUGIN_NAME).use({
        apply(compiler) {
          compiler.hooks.compilation.tap(PLUGIN_NAME, compilation => {
            const templateHooks = expose.LynxTemplatePlugin
              .getLynxTemplatePluginHooks(compilation);
            templateHooks.beforeEncode.tapPromise(PLUGIN_NAME, async args => {
              // ... plugin logic here
              return args;
            });
          });
        },
      });
    });
  },
};
```
