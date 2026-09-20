import { PackageManagerTabs } from '@theme';

# Upgrade Rspeedy

This section explains how to upgrade the project's Rspeedy-related dependencies.

## Use `upgrade-rspeedy`

The Rspeedy project includes several NPM packages with `peerDependencies` constraints. Unmatched `peerDependencies` can lead to compilation and runtime errors.

We recommend using the [`upgrade-rspeedy`](https://www.npmjs.com/package/upgrade-rspeedy) tool to upgrade the Rspeedy version.

:::info
The `upgrade-rspeedy` command will not install dependencies for you.

Please remember to install the dependencies with your package manager.
:::

### Upgrade to the `latest` version (recommended)

To upgrade `@lynx-js/rspeedy` and its plugins to the latest version, use the following command in your project:

<PackageManagerTabs
command={{
npm: `npx upgrade-rspeedy@latest`,
pnpm: `pnpm dlx upgrade-rspeedy@latest`,
bun: `bunx upgrade-rspeedy@latest`,
yarn: `yarn dlx upgrade-rspeedy@latest`,
}}
/>

> For better performance when using **pnpm** in a monolithic repository, use **pnpm dlx** instead of **npx**.

### Upgrade to a specific version

To upgrade `@lynx-js/rspeedy` and its plugins to a specific version, use the following command in your project:

<PackageManagerTabs
command={{
npm: `npx upgrade-rspeedy@0.15.0`,
pnpm: `pnpm dlx upgrade-rspeedy@0.15.0`,
bun: `bunx upgrade-rspeedy@0.15.0`,
yarn: `yarn dlx upgrade-rspeedy@0.15.0`,
}}
/>

Replace the `0.15.0` with the one you would like to install.

### Upgrade to a canary version

:::warning
Please note that the canary version of Rspeedy is released solely for testing purposes.

**IMPORTANT:** Do not use canary versions in production environments.
:::

To upgrade `@lynx-js/rspeedy` and its plugins to a canary version before release, use the following command:

```bash
# Replace the `0.15.1-canary-20260624-897063d1` with your canary version.
pnpm dlx upgrade-rspeedy-canary@0.15.1-canary-20260624-897063d1
```
