<p align="center">
  <a href="https://lynxjs.org/rspeedy" target="blank"><img src="https://lf-lynx.tiktok-cdns.com/obj/lynx-artifacts-oss-sg/lynx-website/assets/rspeedy-banner.png" alt="Rspeedy Logo" /></a>
</p>

# Upgrade Rspeedy

<p>
  <a aria-label="NPM version" href="https://www.npmjs.com/package/upgrade-rspeedy">
    <img alt="" src="https://img.shields.io/npm/v/upgrade-rspeedy?logo=npm">
  </a>
  <a aria-label="License" href="https://www.npmjs.com/package/upgrade-rspeedy">
    <img src="https://img.shields.io/badge/License-Apache--2.0-blue" alt="license" />
  </a>
</p>

The easiest way to upgrade Rspeedy-related packages.

This CLI tool helps to update the `package.json` with corresponding version. Both `latest` and `canary` are supported.

## Latest version

To update to the latest `@lynx-js/rspeedy` and its plugins, use the following command in your `@lynx-js/rspeedy` project:

```bash
npx upgrade-rspeedy@latest
```

Then all the Rspeedy-related packages' version would be updated. Run your package manager to install the dependencies:

```bash
npm install
# Or
yarn install
# Or
pnpm install
```

## Canary version

To update to one of the canary version of `@lynx-js/rspeedy`, use the following command:

```bash
# Replace the version with your canary version
npx upgrade-rspeedy-canary@0.8.2-canary-20250309-870106fc
```

Then all the Rspeedy-related packages' version would be updated with `npm:` alias. Run your package manager to install the dependencies:

```bash
npm install
# Or
yarn install
# Or
pnpm install
```
