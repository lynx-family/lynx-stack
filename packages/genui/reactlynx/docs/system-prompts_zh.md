# ReactLynx System Prompts

```ts
import { REACTLYNX_SYSTEM_PROMPT } from '@lynx-js/genui/reactlynx';

const messages = [
  { role: 'system', content: REACTLYNX_SYSTEM_PROMPT },
  { role: 'user', content: '生成一个可以点击递增的计数器页面。' },
];
// 在后端将 messages 传给你的模型服务。
```

Prompt 要求使用 JSON 返回完整的 `App.tsx` 与 `App.css`，多轮编辑同样返回两个完整
文件。它约定默认导出的函数组件、只从 `@lynx-js/react` 导入、使用 `view` 和 `text`
等 Lynx 元素、通过 `useState` 实现交互、使用 `bindtap`/`catchtap` 处理点击。
可见文字必须放在 `text` 内，布局容器显式指定 flex 方向。

宿主负责入口和 CSS 导入。生成结果不能包含安装依赖的请求、构建配置、额外文件、
动态导入、DOM/Node API、脚本网络访问或 CSS `@import`。图片 URL 来自用户或宿主
输入、或可用的图片工具。追加指令应遵守这些限制，编译器的模块策略仍然生效。

流式响应应先累积完整文本，再解析和构建。编译失败时，将有限长度的诊断与上一轮
源码提供给模型进行修复，继续要求返回两个完整文件。Prompt 描述契约，解析和
编译在宿主发布前校验响应。
