# 快速搭建 Playground

如果已有 Agent 输出，或只是想编辑 JSON 并查看效果，可以直接使用 GenUI Playground
的在线资源搭建自己的预览应用，无需安装 GenUI 或编译 renderer。下面以 A2UI 为例，
用同一份消息分别预览 Web 页面和原生 Lynx 容器页面。

要先体验生成、组件集和示例，可以打开 [GenUI Playground](https://lynx-stack.dev/genui/)。

也可以直接[打开渲染预览](https://lynx-stack.dev/genui/lynx-genui-stream.html)，切换 A2UI 和 OpenUI，
编辑源码，直接渲染或模拟流式渲染。页面使用同一 Playground 部署中的 renderer 和 bundle。
页面默认打开使用 OpenUI Chat 的[北海道示例](https://lynx-stack.dev/genui/lynx-genui-stream.html?inlineMode=1)，
包含随页面打包的图片与交互表单。开启 **Markdown + OpenUI** 即可混合显示文字和 UI 代码块。
这是本页唯一的 OpenUI 示例；完整组件示例仍在主 Playground 中。A2UI 提供最小消息示例，
支持消息数组和 NDJSON。草稿按协议和 inline 模式分别保存。

## 选择预览资源

| 资源                                                        | 用途                                  | 数据入口                     |
| ----------------------------------------------------------- | ------------------------------------- | ---------------------------- |
| [`render.html`](https://lynx-stack.dev/genui/render.html)   | 在浏览器中打开，或嵌入应用的 `iframe` | URL query 或 `postMessage`   |
| [`a2ui.web.js`](https://lynx-stack.dev/genui/a2ui.web.js)   | `render.html` 加载的 A2UI Web bundle  | 由预览页面传入，无需自行加载 |
| [`a2ui.lynx.js`](https://lynx-stack.dev/genui/a2ui.lynx.js) | 由 Android / iOS 等原生 Lynx 容器加载 | 宿主传入 `globalProps`       |

`render.html` 已包含 Lynx for Web 运行时。原生 `.lynx.js` 是 Lynx bundle，
应交给 Lynx 容器加载。两种 bundle 的运行环境不同。

## 1. 准备 A2UI 消息

预览输入是 A2UI v0.9 消息数组：`createSurface` 创建页面，`updateComponents`
描述组件树，`updateDataModel` 更新组件绑定的数据。组件树以 `root` 为根节点。

下面的完整 HTML 示例加载一张商品卡片，包含图片、评分、评论数量、售价、原价和
Add to Cart 按钮。组件树使用 `Card`、`Column`、`Row`、`Image`、`Text` 和 `Button`，
商品信息通过 `updateDataModel` 绑定。
[在线示例 JSON](https://lynx-stack.dev/genui/demos/product-card.json)，其结构是
`{ "name": "...", "description": "...", "messages": [...] }`；预览器既接受消息数组，
也接受这样的 `messages` 包装对象。

在线 bundle 包含 Playground 的内置 Catalog。Agent 生成的组件名和 props 必须匹配
这套 Catalog；设置 `catalogId` 不会下载或注册自定义组件。如果需要自己的业务组件，
请按 [Catalogs 与组件](/zh/guide/genui/a2ui/catalog-guide) 构建自己的 renderer。

## 2. 搭建 Web 预览页面

将下面的代码保存为 `index.html` 并在浏览器中打开，或部署到自己的静态站点。
修改 JSON 后点击 Preview，即可看到新的页面；Open preview 可以单独打开当前预览。
初始示例从在线 JSON 获取，使用时需要联网。

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>A2UI Playground</title>
  <style>
    body { max-width: 960px; margin: 24px auto; padding: 0 16px; }
    textarea { box-sizing: border-box; width: 100%; height: 240px; }
    iframe { width: 390px; max-width: 100%; height: 640px; border: 1px solid #ccc; }
  </style>
  <h1>A2UI Playground</h1>
  <textarea id="messages" aria-label="A2UI messages"></textarea>
  <p>
    <button id="preview" type="button">Preview</button>
    <a id="share" target="_blank" rel="noopener">Open preview</a>
  </p>
  <p id="error" role="alert"></p>
  <iframe id="frame" title="A2UI preview"></iframe>
  <script>
    const editor = document.getElementById('messages');
    const frame = document.getElementById('frame');
    const share = document.getElementById('share');
    const error = document.getElementById('error');
    function preview() {
      try {
        const messages = JSON.parse(editor.value);
        const url = new URL('https://lynx-stack.dev/genui/render.html');
        url.searchParams.set('protocol', 'a2ui');
        url.searchParams.set('messages', JSON.stringify(messages));
        url.searchParams.set('instant', '1');
        url.searchParams.set('theme', 'light');
        frame.src = url.toString();
        share.href = url.toString();
        error.textContent = '';
      } catch (cause) {
        error.textContent = String(cause);
      }
    }
    document.getElementById('preview').addEventListener('click', preview);
    async function loadExample() {
      try {
        const response = await fetch(
          'https://lynx-stack.dev/genui/demos/product-card.json',
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const example = await response.json();
        editor.value = JSON.stringify(example.messages, null, 2);
        preview();
      } catch (cause) {
        error.textContent = String(cause);
      }
    }
    loadExample();
  </script>
</html>
```

使用 `URL.searchParams.set` 编码参数即可保留中文和特殊字符，不需要手动拼接或重复编码。
这里的 `instant=1` 让预览直接显示最终 UI；去掉它可以查看消息逐条播放的效果。

消息较大时，将 JSON 发布到设备可访问的 HTTPS 地址，使用 `messagesUrl` 替代
`messages`。例如直接打开这个[示例预览](https://lynx-stack.dev/genui/render.html?protocol=a2ui&messagesUrl=https%3A%2F%2Flynx-stack.dev%2Fgenui%2Fdemos%2Fproduct-card.json&instant=1)。
JSON 服务必须允许来自 `https://lynx-stack.dev` 的 CORS 读取；浏览器临时的 `blob:` URL
不能作为跨设备分享或原生预览地址。

| Web query 参数                   | 说明                                                    |
| -------------------------------- | ------------------------------------------------------- |
| `protocol=a2ui`                  | 选择 A2UI renderer                                      |
| `messages`                       | JSON 消息数组或包含 `messages` 的对象                   |
| `messagesUrl`                    | 从 URL 获取消息；与 `messages` 同时设置时优先使用它     |
| `instant=1`                      | 直接渲染最终 UI，默认逐条播放                           |
| `theme=light` / `theme=dark`     | 预览主题                                                |
| `actionMocks` / `actionMocksUrl` | 按 action 名称映射的模拟响应消息，内联 JSON 或 JSON URL |
| `liveAction=1`                   | 将 action 转发给父页面，而不是使用模拟响应              |

## 3. 在原生 Lynx 容器中预览

使用已有的 Lynx 宿主或 LynxExplorer 加载在线 `a2ui.lynx.js`。宿主需要支持 renderer
使用的组件和网络请求。下面是加载配置，字段应映射到宿主的 bundle URL 和
`globalProps` 接口；它不是某个 Android / iOS SDK 的调用代码。

```json
{
  "url": "https://lynx-stack.dev/genui/a2ui.lynx.js",
  "globalProps": {
    "messagesUrl": "https://lynx-stack.dev/genui/demos/product-card.json",
    "instant": true,
    "theme": "light"
  }
}
```

如果数据已在宿主内存中，用 `globalProps.messages` 传入第 1 步的消息数组，
并移除 `messagesUrl`。原生配置使用 `instant: true`；Web query 使用 `instant=1`。
只加载 bundle 而不传入消息不会显示你的页面。

支持将 bundle URL query 映射到 `globalProps` 的宿主，也可以使用以下方式生成预览地址：

```js
const nativeUrl = new URL('https://lynx-stack.dev/genui/a2ui.lynx.js');
nativeUrl.searchParams.set(
  'messagesUrl',
  'https://lynx-stack.dev/genui/demos/product-card.json',
);
nativeUrl.searchParams.set('instant', '1');
nativeUrl.searchParams.set('theme', 'light');
console.log(nativeUrl.toString());
```

将该地址交给 LynxExplorer 或宿主的页面打开入口。query 到 `globalProps` 的转换由宿主
完成；如果宿主不支持这种转换，请使用上面的显式加载配置。

## 4. 接入 Agent 和交互

预览资源负责渲染和模拟播放。自己的应用负责收集 Prompt、调用 Agent，以及将返回的
A2UI 消息交给预览器。模型凭证应保留在后端，不要放进预览 URL。

Web 应用可以在收到来自预览 iframe 的 `A2UI_RENDER_READY` 且 `runtimeReady === true`
后，通过 `frame.contentWindow.postMessage({ type: 'A2UI_LIVE_MESSAGES', messages },
'https://lynx-stack.dev')` 追加消息。启用 `liveAction=1` 后，父页面收到
`{ type: 'A2UI_USER_ACTION', action }`，调用自己的 Agent，再通过
`{ type: 'A2UI_ACTION_RESPONSE', messages }` 返回响应。接收事件时同时检查
`event.origin === 'https://lynx-stack.dev'` 和 `event.source === frame.contentWindow`。

原生宿主使用相同的消息类型，通过全局事件发送消息，参数为 `[messages]`。
启用 `globalProps.liveAction: true` 后，需要实现 `NativeModules.bridge.call`
并处理 `A2UI_USER_ACTION`；可以通过 `A2UI_RUNTIME_READY` 确认 renderer 已就绪。
仅查看静态结果时不需要启用 action 转发。商品卡片的 Add to Cart 按钮会产生
`addToCart` action；需要配置 `actionMocks` 才有模拟响应，或接入自己的 Agent 实现逻辑。

## 其他预览格式

- **OpenUI**：使用 `render.html?protocol=openui&demoUrl=./openui.web.js`，通过 `rawText` 或 `rawTextUrl`
  传入 OpenUI Lang 文本；原生宿主加载
  [`openui.lynx.js`](https://lynx-stack.dev/genui/openui.lynx.js)，通过
  `globalProps.rawText` 传入文本，也可在宿主提供 `fetch` 时将绝对源码 URL 传入
  `globalProps.rawTextUrl`。直接传入的 `rawText` 优先于 URL。
  Web URL 使用 `openuiLibrary=chat`、原生宿主使用 `globalProps.openuiLibrary: 'chat'`
  选择 Chat 组件库；省略时使用 Lynx Stack。
  处理混合聊天回复时，Web URL 添加 `inlineMode=1`，原生宿主设置
  `globalProps.inlineMode: true`。`lynx-src/openui/` 中的 Playground 适配层将普通
  Markdown 组件和独立 OpenUI 渲染块按回复顺序穿插展示；Markdown 不注册到 OpenUI
  组件目录。每个 `openui` / `openui-lang` 围栏都需要自己的 `root` 和完整引用声明，
  状态、Query 和 Action 属于各自的代码块。围栏闭合后，即使后续内容还在流式输出，
  该 UI 块也可开始交互。
  核心 `OpenUiRenderer` 仅接收标准 OpenUI Lang。
- **ReactLynx**：使用 `render.html?protocol=reactlynx&bundleUrl=...`，`bundleUrl`
  指向已发布的 Web bundle；原生宿主加载对应的 Native bundle，具体见
  [源码与构建](/zh/guide/genui/reactlynx/source-guide)。
- **Lynx XML**：使用 `render.html?protocol=lynx-xml&sourceUrl=...`，`sourceUrl`
  指向完整、可执行的 `.lynxml` 产物；原生宿主直接加载该产物，具体见
  [产物与校验](/zh/guide/genui/lynx-xml/artifact-guide)。

这些 `sourceUrl`、`bundleUrl` 和 `rawTextUrl` 同样需要设备可访问的地址以及 Web 预览所需的 CORS。
在线资源随网站更新；若需要固定 renderer 版本或自定义组件，请自行构建并发布资源。
