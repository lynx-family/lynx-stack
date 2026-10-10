# ReactLynx 源码与构建

## 两文件契约

响应是一个 JSON 对象，必须且只能包含 `files["App.tsx"]` 和 `files["App.css"]`。
`App.tsx` 非空并默认导出 `App` 函数组件，`App.css` 可以为空。额外文件或顶层字段
会被拒绝。

```ts
const modelOutput = JSON.stringify({
  files: {
    'App.tsx': `import { useState } from '@lynx-js/react';
export default function App() {
  const [count, setCount] = useState(0);
  return <view className="page">
    <text bindtap={() => setCount(value => value + 1)}>Count: {count}</text>
  </view>;
}`,
    'App.css':
      '.page { display: flex; flex-direction: column; padding: 24px; }',
  },
});
```

`parseReactLynxSource` 支持 JSON 和 Markdown JSON 代码块，检查结构与字符串长度
上限：JSON 为 512,000 字符，TSX 为 256,000 字符，CSS 为 128,000 字符。
`normalizeReactLynxSource` 使用相同校验并返回 JSON 字符串。这两个辅助函数不编译
源码，语法与导入检查在编译阶段进行。

## 构建 API

```ts
import { buildReactLynx, parseReactLynxSource } from '@lynx-js/genui/reactlynx';

const controller = new AbortController();
const assets = await buildReactLynx(
  parseReactLynxSource(modelOutput),
  controller.signal,
  status => console.log(status),
);
// 调用 controller.abort() 取消排队或正在执行的构建。
```

回调报告 `queued` 和 `building`。成功后返回 `ReactLynxBuildAsset[]`，每个产物包含
相对路径 `name` 和 `Buffer` 类型的 `data`，其中包括 `main.web.js` 与
`main.lynx.js`。应一起发布全部产物；此 API 不上传文件，也不生成预览 URL。

每个已加载的模块允许同时执行两个构建、排队八个构建，worker 超时为 120 秒，
输出上限为 16 MiB 和 128 个文件。源码无效、队列已满、取消、超时或编译失败时，
Promise 会拒绝。成功或失败后都会清理临时项目。

服务端打包时保持此入口为 external，并保留已安装的运行时依赖，确保相邻的
`build-worker.js` 和模块解析仍可用。
