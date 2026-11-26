# Preview protocol (version 1)

How a host application talks to the preview kit it embeds in an iframe. The shapes are defined in [`src/protocol.ts`](src/protocol.ts); this page explains how to use them. A host that does not want to write messages by hand can use the client in `src/client`.

## Embedding

```html
<iframe
  src="https://preview.example.com/index.html"
  allow="cross-origin-isolated"
></iframe>
```

The kit needs to be cross-origin isolated and to keep its own origin; [`ARCHITECTURE.md`](ARCHITECTURE.md#deployment-requirements) lists what that asks of the deployment. If the requirements are not met, the session still opens and its `hello` event says so.

## Handshake

The handshake uses `window.postMessage`. Every handshake message has `channel: 'lynx-web-preview'`.

1. The kit posts `{ channel, type: 'ready', versions: [1] }` to its parent when it has loaded.
2. A host that may have missed it posts `{ channel, type: 'probe' }` to the iframe; the kit answers with `ready` again.
3. The host creates a `MessageChannel` and posts `{ channel, type: 'connect', version: 1 }` to the iframe, transferring one port.
4. The kit sends the `hello` event over the port. The session is open.

```js
const { port1, port2 } = new MessageChannel();
port1.onmessage = (e) => handle(e.data);
iframe.contentWindow.postMessage(
  { channel: 'lynx-web-preview', type: 'connect', version: 1 },
  KIT_ORIGIN,
  [port2],
);
```

The host should check `event.origin` and `event.source` of the `ready` message, and post `connect` to the kit's origin only. The kit accepts `connect` only from its parent window. A second `connect` replaces the port and keeps the open project.

## Messages on the port

| Direction  | Shape                                                  | Meaning                                       |
| ---------- | ------------------------------------------------------ | --------------------------------------------- |
| host → kit | `{ id, method, params }`                               | A request. `id` is a number the host chooses. |
| kit → host | `{ id, result }` or `{ id, error: { code, message } }` | The response. Exactly one per request.        |
| kit → host | `{ event, data }`                                      | An event.                                     |

Messages are structured-cloned, so file contents can be strings or `Uint8Array`s. Requests are handled in the order they arrive. A message without a numeric `id` cannot be answered and is ignored.

## Files

Paths are relative to the project root and use `/`. A path with a leading `/`, a `.` or `..` segment, an empty segment or a backslash is rejected with `INVALID_PATH`. `node_modules/...` is allowed, which is how a host adds dependencies; `@lynx-js/react` and the other packages listed in `hello.builtinPackages` are already provided.

The kit numbers the states of its file system. `project.open` produces revision 1, and every `fs.apply` or `project.configure` adds one. Each of these requests resolves with the new revision as soon as the files are written, without waiting for a build. `build.start` and `build.done` carry the revision the build saw, so an editor knows which of its edits a build includes.

## Requests

| Method              | Params                            | Result         | Notes                                                                                                                 |
| ------------------- | --------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------- |
| `project.open`      | `{ files, config, card?, data? }` | `{ revision }` | Replaces the open project and starts building. `card` defaults to the first entry. Cancels a running build.           |
| `project.configure` | `{ config }`                      | `{ revision }` | Rebuilds from scratch with a new config, keeping the files. Use it to add or remove entries. Cancels a running build. |
| `project.close`     | none                              | none           | Stops the bundler and removes the preview. Cancels a running build.                                                   |
| `fs.apply`          | `{ changes }`                     | `{ revision }` | One batch, one rebuild. Nothing is applied if any path is invalid.                                                    |
| `fs.read`           | `{ path, encoding? }`             | `{ content }`  | `encoding` is `'utf8'` (default) or `'binary'`.                                                                       |
| `fs.list`           | none                              | `{ files }`    | Sorted project-relative paths.                                                                                        |
| `build.getAsset`    | `{ name }`                        | `{ content }`  | An asset of the latest build, such as `main.web.bundle`.                                                              |
| `preview.select`    | `{ card }`                        | `{ card }`     | Previews another card.                                                                                                |
| `preview.reload`    | none                              | none           | Loads the previewed card again from the latest successful build.                                                      |
| `preview.setData`   | `{ initData?, globalProps? }`     | none           | Updates the card's data.                                                                                              |

`config` is `{ entries, mode?, hmr? }`:

- `entries` maps a card name to its entry module, for example `{ main: 'src/index.tsx', detail: 'src/detail.tsx' }`. Each entry is a card.
- `mode` is `'development'` (default) or `'production'`.
- `hmr` (default `true`) applies rebuilds to the running card as hot updates. It only works in development mode.

A change is one of:

```ts
{
  type: 'write', path, content;
} // create or replace; content is a string or Uint8Array
{
  type: 'delete', path;
} // a file, or a directory and its content
{
  type: 'rename', from, to;
}
```

## Events

| Event           | Data                                                                                | When                                       |
| --------------- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| `hello`         | `{ version, supported, reason?, builtinPackages }`                                  | Once, when the session opens.              |
| `build.start`   | `{ buildId, revision }`                                                             | A build started.                           |
| `build.done`    | `{ buildId, revision, success, hash, durationMs, errors, warnings, cards, assets }` | A build finished.                          |
| `preview.load`  | `{ card, hash, reason }`                                                            | A card started loading from scratch.       |
| `preview.hmr`   | `{ card, hash }`                                                                    | A hot update was sent to the running card. |
| `preview.error` | `{ card, message, stack?, fileName? }`                                              | The running card threw.                    |

`reason` of `preview.load` is `open`, `select`, `reload`, `rebuild` (hot updates are off) or `hmr-fallback`: the card could not apply a hot update, or this is the first successful build after a failed one while hot updates are on. A hot update whose chain passes through a failed build leaves the card partly stale on web, so the kit loads the card again instead.

A cancelled build, one that `project.open`, `project.configure` or `project.close` stopped, has a `build.start` and no `build.done`.

`hello.supported` is false when the iframe is not cross-origin isolated, cannot register a Service Worker, or the kit was deployed without its bundler; `hello.reason` says which.

After a successful build exactly one of these follows: `preview.hmr`, `preview.load`, or nothing when no card is being previewed. After a failed build nothing follows and the running card stays as it was.

## Errors

| Code              | Meaning                                              |
| ----------------- | ---------------------------------------------------- |
| `INVALID_REQUEST` | The message has a numeric `id` but is not a request. |
| `UNKNOWN_METHOD`  | No such method.                                      |
| `INVALID_PARAMS`  | Wrong parameter shape, or a config without entries.  |
| `INVALID_PATH`    | A path breaks the path rules.                        |
| `NOT_OPEN`        | The method needs an open project.                    |
| `NOT_FOUND`       | No such file or asset.                               |
| `UNKNOWN_CARD`    | The card is not an entry.                            |
| `UNSUPPORTED`     | The kit cannot build here; `hello.reason` says why.  |
| `INTERNAL`        | Anything else.                                       |

## A typical session

```
host                                   kit
 │ ◄──────────── ready ──────────────── │
 │ ───────────── connect + port ──────► │
 │ ◄──────────── hello ──────────────── │
 │ ── project.open {files, config} ───► │
 │ ◄──────────── {revision: 1} ──────── │
 │ ◄──────────── build.start ────────── │
 │ ◄──────────── build.done ─────────── │
 │ ◄──────────── preview.load (open) ── │   card "main" renders
 │ ── fs.apply {changes} ─────────────► │   the user types
 │ ◄──────────── {revision: 2} ──────── │
 │ ◄──────────── build.start ────────── │
 │ ◄──────────── build.done ─────────── │
 │ ◄──────────── preview.hmr ────────── │   card updates in place
 │ ── preview.select {card: "detail"} ► │
 │ ◄──────────── preview.load (select)─ │   card "detail" renders
```
