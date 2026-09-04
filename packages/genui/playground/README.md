# GenUI Playground

Interactive playground for the Lynx **GenUI** toolchain. Chat with an agent to
generate A2UI / OpenUI surfaces or standalone HTML documents, browse ready-made
examples (including zero-build Lynx XML artifacts), and preview the result on
the web or a real device — then rename, delete, or **share** any conversation
as a durable preview link.

The Lynx XML protocol exposes a streaming **Create** surface at `#/lynx-xml`
and an **Examples** surface at `#/lynx-xml/examples`. Create calls the GenUI
server's `/lynx-xml/stream` endpoint, shows the `.lynxml` source as it arrives,
and loads the complete zero-build artifact in a directly mounted `<lynx-view>`.
Generated XML never enters the A2UI/OpenUI renderer; the shared `render.html`
entry selects the direct XML path through `protocol=lynx-xml`. Each example uses
the same single-file format with Lynx CSS plus main-thread and, where needed,
background-thread JavaScript.

The bundled cases are Counter, Travel Plan, Product Card, Weather Card, and
Todo List. Together they cover main-thread interaction, subtree re-rendering,
background-thread computation, selection state, and dynamic-list updates
without external media assets. Their cards use the same flow-grid arrangement
and shared card styles as A2UI Playground Examples. The Element PAPI trees
attach an explicitly styled business root directly to an unstyled `page`; each
layout container enables Flex instead of relying on Lynx's default Linear
layout. Examples that can exceed one viewport use that business root itself as
a vertical scroll view.

The HTML protocol exposes a **Create** surface at `#/html`. It calls the GenUI
server's `/html/stream` endpoint, shows the standalone document source while it
streams, and renders the complete HTML through a Web `iframe` `srcDoc`. The
iframe uses `sandbox="allow-scripts"` without same-origin access, so generated
interactions work without exposing the Playground DOM, cookies, or local
storage. HTML never enters the Lynx renderer or native preview path.

> Private development app; it is not published to npm. For the published library
> see [`@lynx-js/genui`](../README.md).

## Quick Start

Run everything from the **repo root**.

```bash
# 1. Install workspace dependencies (first time only)
pnpm install
```

The **Create** (chat) tab talks to the GenUI server for agent responses and
preview publishing. Start it on port `3060`. This example provides one
server-owned model configuration:

```bash
# 2. Start the GenUI server → http://localhost:3060
GENUI_MODEL_CONFIG_JSON='{"GPT-5.4":{"model":"gpt-5.4","apiKey":"sk-...","baseURL":"https://api.openai.com/v1","api":"responses","default":true}}' \
  IMG_GEN_ARK_API_KEY='...' \
  IMG_GEN_ARK_IMAGE_MODEL='doubao-seedream-...' \
  IMG_GEN_ARK_IMAGE_BASE_URL='https://ark.cn-beijing.volces.com/api/v3' \
  SEARCH_INFINITY_API_KEY='...' \
  LYNX_USE_PORT=3060 \
  pnpm -C packages/genui/server dev
```

Then start the playground and open the URL it prints (defaults to
`http://localhost:3000`):

```bash
# 3. Start the playground
pnpm -C packages/genui/playground dev
```

The playground targets `http://localhost:3060` by default. Set the build-time
`GENUI_SERVER_URL` environment variable to use another GenUI server origin:

```bash
GENUI_SERVER_URL=https://genui.example.com \
  pnpm -C packages/genui/playground dev
```

The configured origin is shared by Create, Bench, health checks, and preview
payload publishing. It must be an `http` or `https` origin without credentials,
a path, query parameters, or a fragment.

Create and Bench also retain their URL query overrides for local diagnosis:

```text
?a2uiEndpoint=http://localhost:3060/a2ui/stream
?openuiEndpoint=http://localhost:3060/openui/stream
?mcp-appsEndpoint=http://localhost:3060/mcp-apps/stream
?lynx-xmlEndpoint=http://localhost:3060/lynx-xml/stream
?htmlEndpoint=http://localhost:3060/html/stream
?a2uiBenchEndpoint=http://localhost:3060/a2ui/bench/jobs
```

### Client environment

| Variable                                 | Purpose                                     | Default                    |
| ---------------------------------------- | ------------------------------------------- | -------------------------- |
| `GENUI_SERVER_URL`                       | GenUI server origin used by all APIs        | `http://localhost:3060`    |
| `PORT`                                   | Playground development server port          | `3000`                     |
| `ASSET_PREFIX`                           | Hosted static asset prefix                  | —                          |
| `A2UI_PLAYGROUND_CLIENT_PAYLOAD_PUBLISH` | Set to `0` to disable the dev payload store | enabled outside production |

### Server environment

| Variable                                                       | Purpose                                             | Default             |
| -------------------------------------------------------------- | --------------------------------------------------- | ------------------- |
| `GENUI_MODEL_CONFIG_JSON`                                      | Optional map of server-owned model configurations   | disabled            |
| `IMG_GEN_ARK_API_KEY`                                          | Server-side Volcengine Ark image-generation key     | —                   |
| `IMG_GEN_ARK_IMAGE_MODEL`                                      | Ark image-generation model/endpoint id              | —                   |
| `IMG_GEN_ARK_IMAGE_BASE_URL`                                   | Ark image-generation HTTPS API base URL             | —                   |
| `IMG_GEN_ARK_IMAGE_REQUEST_TIMEOUT_MS`                         | Timeout in ms (integer from 1 through 600000)       | `120000`            |
| `SEARCH_INFINITY_API_KEY`                                      | Optional Doubao Custom subscription/post-paid key   | disabled            |
| `SEARCH_INFINITY_REQUEST_TIMEOUT_MS`                           | Search timeout in ms (integer from 1 through 60000) | `10000`             |
| `UI_JUDGE_SERVER_URL`                                          | Rust UI Judge sidecar for Bench scoring             | disabled            |
| `UI_JUDGE_BUNDLE_URL`                                          | `a2ui.lynx.js` bundle rendered by UI Judge          | hosted GenUI bundle |
| `TOS_ACCESS_KEY`, `TOS_SECRET_KEY`, `TOS_BUCKET`, `TOS_REGION` | Short, shareable preview URLs via Volcengine TOS    | disabled            |

The Create tab loads its model selector from the server's `GET /models`
endpoint. Server-owned provider credentials, upstream model ids, and upstream
API URLs remain server-only. The selector also exposes a `Custom API key`
option with model and API key fields plus an approved-provider endpoint
selector. An empty custom model falls back to `gpt-5.6-terra`, and the endpoint
defaults to `https://api.openai.com/v1`. Custom
model, API key, and base URL values remain only in the current page session and
survive protocol switches within that page. A refresh restores the model and
base URL defaults and clears the API key; none of these fields are written to
browser storage.

Changing the custom endpoint also fills its default model: OpenAI uses
`gpt-5.6-terra`, Google Gemini uses `gemini-3.7-flash`, and OpenRouter uses
`openrouter/auto`. The model field remains editable after it is filled.

When `GENUI_MODEL_CONFIG_JSON` is unset, the Create tab opens directly in this
custom-provider form instead of requiring a server-owned model. A complete
custom configuration can make model requests without
`GENUI_MODEL_CONFIG_JSON`.

Custom base URLs are requested by the GenUI server and must match the approved
OpenAI, Google Gemini, or OpenRouter OpenAI-compatible endpoint. Alternate
origins, ports, paths, credentials, queries, and fragments are rejected. Use
`GENUI_MODEL_CONFIG_JSON` for an intentionally private, HTTP, or custom
endpoint. Public deployments must still protect model routes with
authentication; the allow-list specifically limits custom-provider SSRF
exposure.

The configured text model must support tool/function calls:
the A2UI agent invokes its `generate_image` tool and copies the generated Ark
URL into the final `Image.url` value. One request may invoke the image tool at
most four times across initial generation and validation repairs. Arbitrary
image URLs invented by the text model are rejected. `IMG_GEN_ARK_API_KEY`,
`IMG_GEN_ARK_IMAGE_MODEL`, and `IMG_GEN_ARK_IMAGE_BASE_URL` must all be
configured explicitly. See the
[Volcengine Ark image-generation API](https://www.volcengine.com/docs/82379/1541523?lang=zh)
for model/endpoint setup.

When `SEARCH_INFINITY_API_KEY` is configured, the A2UI agent can call the
server-side `web_search` and `image_search` tools. Web search retrieves current
or explicitly requested public-web information; image search returns existing
image URLs with source and quality metadata. The agent prefers image search
before image generation unless the user explicitly requests original generated
artwork. The key is never sent to the Playground. Each generation may perform
at most three searches combined across the initial response and validation
repairs; each call returns at most five normalized results. Source links and
image URLs must come from the user input or the current request's trusted tool
scope. The server uses the Custom search API so both subscription-plan and
post-paid keys are supported. See the [Doubao Search Custom API documentation](https://www.volcengine.com/docs/87772/2272953?lang=zh)
and [Doubao Search console](https://console.volcengine.com/search-infinity) for
service activation and API-key management.

Bench probes `UI_JUDGE_SERVER_URL/health` once per job and reports Judge as
enabled only when that sidecar is ready. See
[`../ui-judge/README.md`](../ui-judge/README.md#http-server) for the Rust server
startup and model environment.

Conversation **share** links and Web / Native Preview upload through the GenUI
server and consume the public URL returned by it. The playground does not
depend on the storage provider — see [`examples/README.md`](./examples/README.md)
for the server-side bucket setup and local toggles.

## Scripts

| Command        | Description                                              |
| -------------- | -------------------------------------------------------- |
| `pnpm dev`     | Build the Lynx preview bundle, then start the dev server |
| `pnpm build`   | Production build                                         |
| `pnpm preview` | Serve the production build locally                       |
| `pnpm test`    | Run the `rstest` suite                                   |
