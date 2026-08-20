# GenUI Playground

Interactive playground for the Lynx **GenUI** toolchain. Chat with an agent to
generate A2UI / OpenUI surfaces, browse ready-made examples, and preview the
result on the web or a real device — then rename, delete, or **share** any
conversation as a durable preview link.

> Private development app; it is not published to npm. For the published library
> see [`@lynx-js/genui`](../README.md).

## Quick Start

Run everything from the **repo root**.

```bash
# 1. Install workspace dependencies (first time only)
pnpm install
```

The **Create** (chat) tab talks to the GenUI server for agent responses and
preview publishing. Start it on port `3060` with one server-owned model
configuration:

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
| `GENUI_MODEL_CONFIG_JSON`                                      | Map of model names to provider configurations       | —                   |
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
endpoint. Provider credentials, upstream model ids, and upstream API URLs
remain server-only. Each model entry may set `reasoningEffort`; when omitted,
the server uses the minimum `none` effort. The configured text model must
support tool/function calls:
the A2UI agent invokes its `generate_image` tool and copies the generated Ark
URL into the final `Image.url` value. One request may invoke the image tool at
most four times across initial generation and validation repairs. Arbitrary
image URLs invented by the text model are rejected. `IMG_GEN_ARK_API_KEY`,
`IMG_GEN_ARK_IMAGE_MODEL`, and `IMG_GEN_ARK_IMAGE_BASE_URL` must all be
configured explicitly. Generated images use Ark's minimum `1K` output size.
See the
[Volcengine Ark image-generation API](https://www.volcengine.com/docs/82379/1541523?lang=zh)
for model/endpoint setup.

When `SEARCH_INFINITY_API_KEY` is configured, the A2UI agent can call the
server-side `web_search` tool for current or explicitly requested public-web
information. The key is never sent to the Playground. Each generation may
perform at most three searches across the initial response and validation
repairs; each search returns at most five normalized text results. Source links
must come from the user input or the current request's search results. Search
images are intentionally excluded from this first integration. The server uses
the Custom web-search API so both subscription-plan and post-paid keys are
supported. See the [Doubao Search Custom API documentation](https://www.volcengine.com/docs/87772/2272953?lang=zh)
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
