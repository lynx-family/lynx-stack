# GenUI ReactLynx

[English](./README.md) | 简体中文

ReactLynx 接入将用户需求生成完整、可交互的 Lynx 页面。模型返回 `App.tsx` 和
`App.css`，你的 Node.js 后端校验响应、编译 Web 与 Native bundle，再发布全部
构建产物供宿主加载。

## 安装

```bash
pnpm add @lynx-js/genui @lynx-js/react
```

## 生成与构建

```ts
import {
  buildReactLynx,
  parseReactLynxSource,
  REACTLYNX_SYSTEM_PROMPT,
} from '@lynx-js/genui/reactlynx';

// 将 REACTLYNX_SYSTEM_PROMPT 作为模型的 system message。
// modelOutput 是你的模型接入层收到的完整响应文本。
const source = parseReactLynxSource(modelOutput);
const controller = new AbortController();
const assets = await buildReactLynx(source, controller.signal, status => {
  console.log(status); // queued，然后是 building
});
```

这些 API 也从 `@lynx-js/genui` 根入口导出。Node.js 工具和服务端可使用专用子路径。
打包服务端时将 `@lynx-js/genui/reactlynx` 保持为 external，确保编译 worker
仍位于入口文件旁边。

发布每个 asset 时保留 `name` 的相对路径，使用 `data` 中的二进制内容。Lynx for Web
加载 `main.web.js`，Native Lynx 宿主加载 `main.lynx.js`。构建 API 返回产物；
存储、公开 URL、模型调用和传输由应用负责。编译和发布完成后再渲染最终 bundle。

## 文档目录

- [概览与架构](./docs/overview_zh.md)
- [源码与构建](./docs/source-guide_zh.md)
- [System Prompts](./docs/system-prompts_zh.md)

可以在 [GenUI Playground](https://lynx-stack.dev/genui/) 中体验生成与预览。
