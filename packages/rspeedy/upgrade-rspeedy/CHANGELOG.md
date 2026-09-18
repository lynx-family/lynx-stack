# upgrade-rspeedy

## 0.18.0

### Patch Changes

- Stop managing `@lynx-js/docs-mcp-server` in `upgrade-rspeedy` after the docs MCP server moves to `lynx-community/skills`. ([#3955](https://github.com/lynx-family/lynx-stack/pull/3955))

- Upgrade every published `@lynx-js/` package, not just the ones a scaffolded project starts with. A project using an external bundle no longer has `@lynx-js/lynx-bundle-rslib-config` left behind while `@lynx-js/rspeedy` moves on. ([#3815](https://github.com/lynx-family/lynx-stack/pull/3815))

## 0.17.2

## 0.17.1

## 0.17.0

## 0.16.5

## 0.16.4

## 0.16.3

## 0.16.2

## 0.16.1

## 0.16.0

## 0.15.2

## 0.15.1

## 0.15.0

## 0.14.5

## 0.14.4

## 0.14.3

## 0.14.2

## 0.14.1

## 0.14.0

## 0.13.6

## 0.13.5

## 0.13.4

## 0.13.3

## 0.13.2

## 0.13.1

### Patch Changes

- Fix the issue `rslib-runtime.js` was not published in dist folder. ([#2122](https://github.com/lynx-family/lynx-stack/pull/2122))

## 0.13.0

## 0.12.5

## 0.12.4

## 0.12.3

## 0.12.2

## 0.12.1

## 0.12.0

## 0.11.9

## 0.11.8

## 0.11.7

## 0.11.6

## 0.11.5

## 0.11.4

## 0.11.3

## 0.11.2

## 0.11.1

## 0.11.0

## 0.10.8

## 0.10.7

## 0.10.6

## 0.10.5

## 0.10.4

## 0.10.3

## 0.10.2

## 0.10.1

## 0.10.0

## 0.9.11

## 0.9.10

## 0.9.9

## 0.9.8

## 0.9.7

## 0.9.6

## 0.9.5

## 0.9.4

## 0.9.3

## 0.9.2

## 0.9.1

## 0.9.0

## 0.8.7

## 0.8.6

### Patch Changes

- Add Web platform packages. ([#312](https://github.com/lynx-family/lynx-stack/pull/312))

  This update introduces support for upgrading web platform packages:

  - `@lynx-js/web-core`: Core web platform functionality
  - `@lynx-js/web-elements`: Web elements and components

  Usage:

  ```bash
  npx upgrade-rspeedy
  ```

  This command will now handle the upgrade process for both web platform packages automatically.

## 0.8.5

## 0.8.4
