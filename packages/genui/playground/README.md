# GenUI Playground

Interactive playground for the Lynx **GenUI** toolchain. Chat with an agent to
generate A2UI, OpenUI, MCP Apps, or zero-build Lynx XML surfaces, browse
ready-made examples, and preview the result — then rename, delete, or **share**
any conversation as a durable preview link. Lynx XML contains Lynx CSS and
Element PAPI JavaScript and is loaded directly by `<lynx-view>`.

> Private development app; it is not published to npm. For the published library
> see [`@lynx-js/genui`](../README.md).

## Quick Start

Run everything from the **repo root**.

```bash
# 1. Install workspace dependencies (first time only)
pnpm install
```

The **Create** (chat) tab talks to the GenUI server for agent responses and
preview publishing. Start it on port `3060` with at least an OpenAI key:

```bash
# 2. Start the GenUI server → http://localhost:3060
OPENAI_API_KEY=sk-... pnpm -C packages/genui/server dev
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
http://localhost:3000/?lynx-xmlEndpoint=https%3A%2F%2Fgenui-server.vercel.app%2Flynx-xml%2Fstream#/lynx-xml
```

If generation reports that the local GenUI server is unreachable, verify that
the server command in step 2 is still running and that port `3060` is
accessible from the browser host.

Development builds prefer the local GenUI server even when the Playground is
opened through an IPv6 loopback or a custom development hostname. Set
`GENUI_PLAYGROUND_LOCAL_SERVER=0` before starting the Playground to disable
that behavior.

### Server environment

| Variable                                                                     | Purpose                                            | Default             |
| ---------------------------------------------------------------------------- | -------------------------------------------------- | ------------------- |
| `OPENAI_API_KEY`                                                             | Agent model access (required for the Create tab)   | —                   |
| `OPENAI_MODEL`                                                               | Model id                                           | `gpt-4o-mini`       |
| `OPENAI_BASE_URL`                                                            | Custom OpenAI-compatible endpoint                  | OpenAI              |
| `OPENAI_FETCH_TIMEOUT_MS`                                                    | Upstream response headers/body inactivity timeout  | `600000` (10 min)   |
| `AIDP_LOG_ID`                                                                | Optional `X-TT-LOGID` for the AIDP crawl endpoint  | Generated per call  |
| `SUPABASE_URL`, `SUPABASE_S3_ACCESS_KEY_ID`, `SUPABASE_S3_SECRET_ACCESS_KEY` | Short, shareable preview URLs via Supabase Storage | in-memory dev store |
| `PEXELS_API_KEY`                                                             | Stock-image search in generated UIs                | —                   |

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
