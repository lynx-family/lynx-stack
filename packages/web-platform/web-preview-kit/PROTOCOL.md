# Preview protocol

How an embedding application drives the preview kit. The shapes and their documentation are in [`src/protocol.ts`](src/protocol.ts); this page explains how to use them. The embedder is trusted to send well-formed messages: the kit does not validate them.

## Handshake

Both handshake messages have `channel: 'lynx-web-preview'` and travel with `window.postMessage`.

1. The kit posts `{ channel, type: 'ready' }` to `window.parent` once, when it has loaded.
2. The parent posts `{ channel, type: 'connect' }` to the kit, transferring one `MessagePort`. Everything after the handshake travels over that port.

```js
const { port1, port2 } = new MessageChannel();
port1.onmessage = (event) => handle(event.data);
iframe.contentWindow.postMessage(
  { channel: 'lynx-web-preview', type: 'connect' },
  KIT_ORIGIN,
  [port2],
);
```

The kit accepts `connect` only from its parent window, and only the first one; later ones are ignored. When the kit is the top-level page, its parent is itself: only scripts of the page can connect, with `window.postMessage`.

## Messages on the port

| Direction      | Shape                                           | Meaning                                                      |
| -------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| embedder → kit | `{ id, method, params }`                        | A request. `id` is a number the embedder chooses.            |
| kit → embedder | `{ id, result }` or `{ id, error: { message }}` | The response: one per request, in the order of the requests. |
| kit → embedder | `{ event, data }`                               | An event.                                                    |

The error message is the message of whatever was thrown while the request was handled. Messages are structured-cloned, so file contents can be strings or `Uint8Array`s.

## Requests

| Method              | Params                            | Result         | Notes                                                                                |
| ------------------- | --------------------------------- | -------------- | ------------------------------------------------------------------------------------ |
| `project.open`      | `{ files, config, card?, data? }` | `{ revision }` | Replaces the open project and starts building. `card` defaults to the first entry.   |
| `project.configure` | `{ config }`                      | `{ revision }` | Rebuilds from scratch with a new config, keeping the files. Adds or removes entries. |
| `project.close`     | none                              | none           | Stops the bundler and removes the preview.                                           |
| `fs.apply`          | `{ changes }`                     | `{ revision }` | One batch, one rebuild.                                                              |
| `fs.read`           | `{ path, encoding? }`             | `{ content }`  | `encoding` is `'utf8'` (default) or `'binary'`.                                      |
| `fs.list`           | none                              | `{ files }`    | Sorted project-relative paths.                                                       |
| `build.getAsset`    | `{ name }`                        | `{ content }`  | An asset of the latest build, such as `main.web.bundle`.                             |
| `preview.select`    | `{ card }`                        | `{ card }`     | Previews another card.                                                               |
| `preview.reload`    | none                              | none           | Loads the card again from the latest successful build.                               |
| `preview.setData`   | `{ initData?, globalProps? }`     | none           | Updates the card's data; omitted fields keep their value.                            |

`config` is `{ entries }`: card name to entry module, such as `{ main: 'src/index.tsx', detail: 'src/detail.tsx' }`. Every build is a development build with hot updates.

Paths are relative to the project root and use `/`. A change is `{ type: 'write', path, content }`, `{ type: 'delete', path }` or `{ type: 'rename', from, to }`. `node_modules/...` paths add dependencies; `@lynx-js/react` is provided.

The kit numbers the states of its file system. `project.open` produces revision 1, and every `fs.apply` or `project.configure` adds one. These requests resolve once the files are written, without waiting for the build. `build.start` and `build.done` carry the revision the build saw.

## Events

| Event          | Data                                                                                | When                                       |
| -------------- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| `build.start`  | `{ buildId, revision }`                                                             | A build started.                           |
| `build.done`   | `{ buildId, revision, success, hash, durationMs, errors, warnings, cards, assets }` | A build finished.                          |
| `preview.load` | `{ card, hash, reason }`                                                            | A card started loading from scratch.       |
| `preview.hmr`  | `{ card, hash }`                                                                    | A hot update was sent to the running card. |

After a successful build, either `preview.hmr` or `preview.load` follows. After a failed build nothing follows and the card stays as it was. A build that `project.open`, `project.configure` or `project.close` stopped has a `build.start` and no `build.done`.

`reason` of `preview.load` is:

- `open`: the first successful build after `project.open` or `project.configure`;
- `select` or `reload`: the request of that name;
- `hmr-fallback`: the card could not apply a hot update, or this is the first successful build after a failed one. On web, a hot update through a failed build leaves the card partly stale, so the kit loads the card again.

## A typical session

```
embedder                               kit
 │ ◄──────────── ready ──────────────── │
 │ ───────────── connect + port ──────► │
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
