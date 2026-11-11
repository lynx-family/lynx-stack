# ReactLynx 概览与架构

模型编写 ReactLynx 函数组件和普通 CSS，宿主负责入口、编译配置、运行时依赖和
bundle 加载。此接入使用生成的源码，需要编译后渲染；A2UI 和 OpenUI 则通过
Catalog 或 Library 定义可用组件。

## 生成流程

1. 将 `REACTLYNX_SYSTEM_PROMPT` 与用户需求发送给模型。
2. 累积响应片段，使用 `parseReactLynxSource` 解析完整响应。
3. 在 Node.js 中调用 `buildReactLynx`，传入 `AbortSignal` 与进度回调。
4. 发布全部构建产物，保留各文件的相对路径。
5. 在 Lynx 宿主中加载对应的 Web 或 Native 入口 bundle。

宿主提供 `root.render(<App />)` 并导入 `App.css`。生成代码只导入 `@lynx-js/react`，
通过 Lynx 元素、React 状态和 Lynx 事件处理器实现页面内交互。

## 应用负责的部分

模型凭证和存储访问放在后端。将取消操作连接到构建的 `AbortSignal`，向用户展示
编译诊断，仅在构建完成并发布后更新预览。多轮编辑时，将上一轮源码与新需求发给
模型，要求每次重新返回两个完整文件。

编译器在独立子进程中使用受限环境和有界资源，编译前检查源码语法和模块请求，
只执行宿主提供的构建配置。这些检查不等同于组件白名单或通用运行时沙箱；
生成 bundle 的运行环境由宿主控制。

继续阅读[源码与构建](./source-guide_zh.md)和 [System Prompts](./system-prompts_zh.md)。
