# @lynx-js/i18next-translation-dedupe

## 0.0.1

### Patch Changes

- Introduce `@lynx-js/i18next-translation-dedupe` package to avoid bundling i18next translations twice in Lynx apps. ([#2482](https://github.com/lynx-family/lynx-stack/pull/2482))

  The package reads translations extracted by `rsbuild-plugin-i18next-extractor`, skips the extractor's default rendered asset, and writes the translations into the Lynx bundle custom section:

  ```json
  {
    "customSections": {
      "i18next-translations": {
        "content": {
          "en-US": {
            "hello": "Hello"
          },
          "zh-CN": {
            "hello": "你好"
          }
        }
      }
    }
  }
  ```
