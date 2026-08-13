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
  pnpm -C packages/genui/server dev
```

Then start the playground and open the URL it prints (defaults to
`http://localhost:3000`):

```bash
# 3. Start the playground
pnpm -C packages/genui/playground dev
```

On `localhost`, the Create tab automatically targets your local server on
`:3060`. To use the **hosted** agent without running a server of your own,
append the endpoint override to the playground URL:

```text
?a2uiEndpoint=https://genui-server.vercel.app/a2ui/stream
```

### Server environment

| Variable                                                                     | Purpose                                            | Default             |
| ---------------------------------------------------------------------------- | -------------------------------------------------- | ------------------- |
| `GENUI_MODEL_CONFIG_JSON`                                                    | Map of model names to provider configurations      | —                   |
| `UI_JUDGE_SERVER_URL`                                                        | Rust UI Judge sidecar for Bench scoring            | disabled            |
| `UI_JUDGE_BUNDLE_URL`                                                        | `a2ui.lynx.js` bundle rendered by UI Judge         | hosted GenUI bundle |
| `SUPABASE_URL`, `SUPABASE_S3_ACCESS_KEY_ID`, `SUPABASE_S3_SECRET_ACCESS_KEY` | Short, shareable preview URLs via Supabase Storage | in-memory dev store |
| `PEXELS_API_KEY`                                                             | Stock-image search in generated UIs                | —                   |

The Create tab loads its model selector from the server's `GET /models`
endpoint. Provider credentials, upstream model ids, and upstream API URLs
remain server-only.

Bench probes `UI_JUDGE_SERVER_URL/health` once per job and reports Judge as
enabled only when that sidecar is ready. See
[`../ui-judge/README.md`](../ui-judge/README.md#http-server) for the Rust server
startup and model environment.

Conversation **share** links and Web / Native Preview reuse the Supabase Storage
payload-publishing path — see [`examples/README.md`](./examples/README.md) for
the bucket setup and local toggles.

## Scripts

| Command        | Description                                              |
| -------------- | -------------------------------------------------------- |
| `pnpm dev`     | Build the Lynx preview bundle, then start the dev server |
| `pnpm build`   | Production build                                         |
| `pnpm preview` | Serve the production build locally                       |
| `pnpm test`    | Run the `rstest` suite                                   |
