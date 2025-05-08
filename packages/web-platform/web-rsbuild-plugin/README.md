# @lynx-js/web-platform-rsbuild-plugin

Lynx3 Web Platform rsbuild plugin

## Usage

```ts
import { pluginWebPlatform } from '@lynx-js/web-platform-rsbuild-plugin';
import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  plugins: [pluginWebPlatform({
    // replace with your actual native-modules file path
    nativeModulesPath: path.resolve(__dirname, './index.native-modules.ts'),
  })],
});
```

## Options

```ts
{
  /**
   * Whether to polyfill the packages about Lynx Web Platform.
   *
   * If it is true, @lynx-js will be compiled and polyfills will be added.
   *
   * @default true
   */
  polyfill?: boolean;
  /**
   * The absolute path of the native-modules file.
   *
   * If you use it, you don't need to pass nativeModulesMap in the lynx-view tag, otherwise it will cause duplicate packaging.
   *
   * When enabled, nativeModules will be packaged directly into the worker chunk instead of being transferred through Blob.
   */
  nativeModulesPath?: string;
}
```

### nativeModulesPath

`native-modules.ts` example:

```ts
// index.native-modules.ts
export default {
  CustomModule: function(NativeModules, NativeModulesCall) {
    return {
      async getColor(data, callback) {
        const color = await NativeModulesCall('getColor', data);
        callback(color);
      },
    };
  },
};
```
