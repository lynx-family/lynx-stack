import { PackageManagerTabs } from '@theme';

# 升级 Rspeedy

本节介绍如何升级项目中的 Rspeedy 相关依赖。

## 使用 `upgrade-rspeedy`

Rspeedy 项目包含几个带有 `peerDependencies` 约束的 NPM 包。不匹配的 `peerDependencies` 可能导致编译和运行时错误。

我们建议使用 [`upgrade-rspeedy`](https://www.npmjs.com/package/upgrade-rspeedy) 工具来升级 Rspeedy 版本。

:::info
`upgrade-rspeedy` 命令不会为你安装依赖。

请记得使用你的包管理器安装依赖项。
:::

### 升级到 `latest` 版本（推荐）

要将 `@lynx-js/rspeedy` 及其插件升级到最新版本，请在你的项目中使用以下命令：

<PackageManagerTabs
command={{
npm: `npx upgrade-rspeedy@latest`,
pnpm: `pnpm dlx upgrade-rspeedy@latest`,
bun: `bunx upgrade-rspeedy@latest`,
yarn: `yarn dlx upgrade-rspeedy@latest`,
}}
/>

> 为了避免在较大的仓库中使用 npx 遇到的性能问题，在基于 pnpm 的 monorepo 中可以使用 **pnpm dlx**

### 升级到特定版本

要将 `@lynx-js/rspeedy` 及其插件升级到特定版本，请在你的项目中使用以下命令：

<PackageManagerTabs
command={{
npm: `npx upgrade-rspeedy@0.15.0`,
pnpm: `pnpm dlx upgrade-rspeedy@0.15.0`,
bun: `bunx upgrade-rspeedy@0.15.0`,
yarn: `yarn dlx upgrade-rspeedy@0.15.0`,
}}
/>

将 `0.15.0` 替换为你想要安装的版本。

### 升级到 canary 版本

:::warning
请注意，Rspeedy 的 canary 版本仅发布用于测试目的。

**重要提示：** 不要在生产环境中使用 canary 版本。
:::

要在正式发布前将 `@lynx-js/rspeedy` 及其插件升级到 canary 版本，请使用以下命令：

```bash
# 将 `0.15.1-canary-20260624-897063d1` 替换为你的 canary 版本。
npx upgrade-rspeedy-canary@0.15.1-canary-20260624-897063d1
```
