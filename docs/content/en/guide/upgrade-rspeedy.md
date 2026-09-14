# Upgrade Rspeedy

This section explains how to upgrade the project's Rspeedy-related dependencies.

## Get CHANGELOG

The CHANGELOG of each packages is published within the npm package.

We also make the CHANGELOGs available at this website. See:

- [`@lynx-js/react`](/changelog/lynx-js--react)
- [`@lynx-js/rspeedy`](/changelog/lynx-js--rspeedy)
- [`@lynx-js/react-rsbuild-plugin`](/changelog/lynx-js--react-rsbuild-plugin)
- [`@lynx-js/qrcode-rsbuild-plugin`](/changelog/lynx-js--qrcode-rsbuild-plugin)

## Use `upgrade-rspeedy`

The Rspeedy project includes several NPM packages with `peerDependencies` constraints. Unmatched `peerDependencies` can lead to compilation and runtime errors.

We recommend using the [`upgrade-rspeedy`](https://npmjs.org/package/upgrade-rspeedy) tool to upgrade the Rspeedy version.

:::info
The `upgrade-rspeedy` command will not install dependencies for you.

Please remember to install the dependencies with your package manager.
:::

### Upgrade to the `latest` version (recommended)

To upgrade `@lynx-js/rspeedy` and its plugins to the latest version, use the following command in your project:

```bash
npx upgrade-rspeedy@latest
```

### Upgrade to a specific version

To upgrade `@lynx-js/rspeedy` and its plugins to a specific version, use the following command in your project:

```bash
# Replace the `0.8.3` with the one you would like to install.
npx upgrade-rspeedy@0.8.3
```

### Upgrade to a canary version

:::warning
Please note that the canary version of Rspeedy is released solely for testing purposes.

**IMPORTANT:** Do not use canary versions in production environments.
:::

To upgrade `@lynx-js/rspeedy` and its plugins to a canary version before release, use the following command:

```bash
# Replace the `0.3.0-next-20240823-28a1e571` with your canary version.
pnpm dlx upgrade-rspeedy-canary@0.8.2-canary-20250309-870106fc
```
