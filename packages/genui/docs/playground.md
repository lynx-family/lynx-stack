# Build a playground

If you already have Agent output, or want to edit JSON and inspect the result, use
the hosted GenUI Playground resources to build your own preview app. You do not
need to install GenUI or compile a renderer. This quick start uses the same A2UI
messages to preview a Web page and a page in a native Lynx container.

To try generation, component sets, and examples first, open the
[GenUI Playground](https://lynx-stack.dev/genui/).

You can also [open the renderer preview](https://lynx-stack.dev/genui/lynx-genui-stream.html)
to switch between A2UI and OpenUI, edit source, and render it immediately or
simulate streaming. The page uses the renderer and bundles from the same Playground deployment.
The page opens the [Hokkaido example](https://lynx-stack.dev/genui/lynx-genui-stream.html?inlineMode=1)
using OpenUI Chat, with packaged images and interactive forms. Enable **Markdown + OpenUI**
to render prose and fenced UI together. This is the page's only OpenUI example;
the full component examples remain in the main Playground. A2UI starts with a minimal
message sequence and accepts message arrays or NDJSON. Source drafts are saved
separately for each protocol and inline mode.

## Choose preview resources

| Resource                                                    | Purpose                                           | Data input                                             |
| ----------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------ |
| [`render.html`](https://lynx-stack.dev/genui/render.html)   | Open in a browser or embed in your app's `iframe` | URL query or `postMessage`                             |
| [`a2ui.web.js`](https://lynx-stack.dev/genui/a2ui.web.js)   | A2UI Web bundle loaded by `render.html`           | Passed by the preview page; no separate loading needed |
| [`a2ui.lynx.js`](https://lynx-stack.dev/genui/a2ui.lynx.js) | Load in a native Lynx container on Android / iOS  | Host-provided `globalProps`                            |

`render.html` includes the Lynx for Web runtime. The native `.lynx.js` resource is
a Lynx bundle that a Lynx container loads. The two bundles target different runtimes.

## 1. Prepare A2UI messages

Preview input is an array of A2UI v0.9 messages: `createSurface` creates a surface,
`updateComponents` describes its component tree, and `updateDataModel` updates
data bound to components. The component tree starts at `root`.

The complete HTML example below loads a product card with an image, rating,
review count, price, original price, and an Add to Cart button. Its component tree
uses `Card`, `Column`, `Row`, `Image`, `Text`, and `Button`, with `updateDataModel`
providing the product data. The
[hosted example JSON](https://lynx-stack.dev/genui/demos/product-card.json), shaped
as `{ "name": "...", "description": "...", "messages": [...] }`. The preview accepts
both message arrays and these `messages` wrapper objects.

The hosted bundle contains the Playground's built-in Catalog. Agent-generated
component names and props must match that Catalog; setting `catalogId` does not
download or register custom components. For your own business components, build
your renderer following [Catalogs and components](/guide/genui/a2ui/catalog-guide).

## 2. Build a Web preview page

Save the following as `index.html` and open it in a browser, or deploy it to your
static site. Edit the JSON and click Preview to see the updated page. Open preview
opens the current preview in a separate tab. The initial example is fetched from
the hosted JSON, so an internet connection is required.

```html
<!DOCTYPE html>
<html lang="en">
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

Use `URL.searchParams.set` to preserve Unicode and special characters without
manually concatenating or double-encoding parameters. `instant=1` displays the
final UI immediately; remove it to watch messages play back one at a time.

For larger messages, publish the JSON at a device-accessible HTTPS URL and use
`messagesUrl` instead of `messages`. Try this
[example preview](https://lynx-stack.dev/genui/render.html?protocol=a2ui&messagesUrl=https%3A%2F%2Flynx-stack.dev%2Fgenui%2Fdemos%2Fproduct-card.json&instant=1).
The JSON service must allow CORS reads from `https://lynx-stack.dev`. Temporary
browser `blob:` URLs cannot be used for sharing across devices or native previews.

| Web query parameter              | Meaning                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `protocol=a2ui`                  | Select the A2UI renderer                                                          |
| `messages`                       | JSON message array or object containing `messages`                                |
| `messagesUrl`                    | Fetch messages from a URL; takes precedence over `messages`                       |
| `instant=1`                      | Render the final UI immediately; default playback delivers messages one at a time |
| `theme=light` / `theme=dark`     | Preview theme                                                                     |
| `actionMocks` / `actionMocksUrl` | Mock response messages keyed by action name, as inline JSON or a JSON URL         |
| `liveAction=1`                   | Forward actions to the parent page instead of using mock responses                |

## 3. Preview in a native Lynx container

Load the hosted `a2ui.lynx.js` in your existing Lynx host or LynxExplorer. The host
must support the renderer's components and network requests. This loading
configuration maps to your host's bundle URL and `globalProps` interfaces; it is
not an Android / iOS SDK call.

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

If the data is already in host memory, pass the message array from step 1 as
`globalProps.messages` and remove `messagesUrl`. Native configuration uses
`instant: true`; the Web query uses `instant=1`. Loading only the bundle without
passing messages will not display your page.

For hosts that map bundle URL query parameters to `globalProps`, generate a
preview URL like this:

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

Pass this URL to LynxExplorer or your host's page-opening entry point. The host
owns the conversion from query parameters to `globalProps`. If it does not
support that conversion, use the explicit loading configuration above.

## 4. Connect your Agent and interactions

Preview resources provide rendering and mock playback. Your app collects
prompts, calls your Agent, and delivers the resulting A2UI messages to the
preview. Keep model credentials on your backend, outside preview URLs.

After receiving `A2UI_RENDER_READY` with `runtimeReady === true` from the preview
iframe, a Web app can append messages with
`frame.contentWindow.postMessage({ type: 'A2UI_LIVE_MESSAGES', messages },
'https://lynx-stack.dev')`. With `liveAction=1`, the parent receives
`{ type: 'A2UI_USER_ACTION', action }`, calls its Agent, and sends back
`{ type: 'A2UI_ACTION_RESPONSE', messages }`. Check both
`event.origin === 'https://lynx-stack.dev'` and
`event.source === frame.contentWindow` when receiving events.

Native hosts use the same message types through global events with `[messages]`
as their arguments. Enabling `globalProps.liveAction: true` requires implementing
`NativeModules.bridge.call` and handling `A2UI_USER_ACTION`.
`A2UI_RUNTIME_READY` confirms that the renderer is ready. Static previews do not
require action forwarding. The product card's Add to Cart button emits the
`addToCart` action; supply `actionMocks` for a simulated response or connect your
Agent to implement it.

## Other preview formats

- **OpenUI**: Use `render.html?protocol=openui&demoUrl=./openui.web.js` with OpenUI Lang text in `rawText`
  or `rawTextUrl`. Native hosts load
  [`openui.lynx.js`](https://lynx-stack.dev/genui/openui.lynx.js) and pass text in
  `globalProps.rawText`, or set `globalProps.rawTextUrl` to an absolute source URL
  when the host provides `fetch`. Inline `rawText` takes precedence over the URL.
  Select the Chat vocabulary with `openuiLibrary=chat` in the Web URL or
  `globalProps.openuiLibrary: 'chat'` on native. Omitted values use Lynx Stack.
  For mixed chat replies, add `inlineMode=1` to the Web URL or set
  `globalProps.inlineMode: true` in the native host. The Playground adapter in
  `lynx-src/openui/` renders ordinary Markdown components and independent OpenUI
  blocks in response order. Markdown is not registered in the OpenUI catalog.
  Each labelled `openui` / `openui-lang` fence needs its own `root` and all its
  referenced declarations; state, queries and actions belong to that block.
  Closed fences become interactive while later Markdown or UI is still streaming.
  The core `OpenUiRenderer` accepts standard OpenUI Lang only.
- **ReactLynx**: Use `render.html?protocol=reactlynx&bundleUrl=...` with a published
  Web bundle at `bundleUrl`. Native hosts load the corresponding Native bundle;
  see [Source and builds](/guide/genui/reactlynx/source-guide).
- **Lynx XML**: Use `render.html?protocol=lynx-xml&sourceUrl=...` with a complete,
  executable `.lynxml` artifact at `sourceUrl`. Native hosts load that artifact
  directly; see [Artifacts and validation](/guide/genui/lynx-xml/artifact-guide).

These `sourceUrl`, `bundleUrl`, and `rawTextUrl` resources also need device-accessible URLs and
CORS for Web previews. Hosted resources update with the website; build and publish
your own resources when you need a pinned renderer version or custom components.
