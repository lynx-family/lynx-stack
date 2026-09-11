# @lynx-js/react-compat

`@lynx-js/react/compat`, published under a React version number.

Many React libraries declare `react` as a peer dependency and import it directly. In a ReactLynx project no package named `react` is installed, so strict package managers (for example pnpm with `strict-peer-dependencies`) refuse to install such libraries even though Rspeedy already resolves `react` to `@lynx-js/react/compat` at build time.

This package fills that gap the same way [`@preact/compat`](https://www.npmjs.com/package/@preact/compat) does for Preact: install it under the `react` name so the peer dependency is met. Its version follows the React release whose API surface `@lynx-js/react/compat` mirrors, not the `@lynx-js/react` version.

## Usage

```json
{
  "dependencies": {
    "@lynx-js/react": "^0.126.0",
    "react": "npm:@lynx-js/react-compat"
  }
}
```

With Rspeedy, `react` is aliased to `@lynx-js/react/compat` regardless of what is installed, so this package only needs to exist for the package manager. Outside Rspeedy (for example in test runners that resolve from `node_modules`), it re-exports `@lynx-js/react/compat`, `@lynx-js/react/jsx-runtime` and `@lynx-js/react/jsx-dev-runtime`.

## Credits

Thanks to [@preact/compat](https://github.com/preactjs/compat-alias-package) for the approach.
