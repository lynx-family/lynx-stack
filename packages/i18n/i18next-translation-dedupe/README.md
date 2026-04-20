<h2 align="center">@lynx-js/i18next-translation-dedupe</h2>

Dedupe i18next translations between Rspeedy build output and Lynx runtime.

## Install

```bash
npm install i18next
npm install -D @lynx-js/i18next-translation-dedupe rsbuild-plugin-i18next-extractor i18next-cli
```

## Rspeedy Usage

```ts
import { defineConfig } from '@lynx-js/rspeedy';
import { pluginI18nextExtractor } from 'rsbuild-plugin-i18next-extractor';
import { pluginLynxI18nextTranslationDedupe } from '@lynx-js/i18next-translation-dedupe';

export default defineConfig({
  plugins: [
    pluginI18nextExtractor({
      localesDir: './src/locales',
    }),
    pluginLynxI18nextTranslationDedupe(),
  ],
});
```

`pluginLynxI18nextTranslationDedupe()` reads extracted translations from `rsbuild-plugin-i18next-extractor`, skips the extractor's default rendered asset to avoid bundling translations twice, and writes the translations into the Lynx bundle `customSections` for runtime loading.

## Runtime Usage

```ts
import i18next from 'i18next';
import { loadI18nextTranslations } from '@lynx-js/i18next-translation-dedupe';

await i18next.init({
  lng: 'en-US',
  fallbackLng: 'en-US',
  resources: loadI18nextTranslations(),
});
```

## Custom Section Contract

The package uses one custom section key:

- `i18next-translations`

Its content is expected to be a locale-to-translation-object map:

```ts
{
  'en-US': {
    hello: 'Hello',
  },
  'zh-CN': {
    hello: '你好',
  },
}
```

At runtime, `loadI18nextTranslations()` converts that shape into i18next's `Resource` format:

```ts
{
  'en-US': {
    translation: {
      hello: 'Hello',
    },
  },
}
```
