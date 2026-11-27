# Independent Island producer

This project builds `xml/greeting.lynxml` into `dist/greeting.lynx.bundle`
using only Rsbuild and `@lynx-js/islands/build`. It has no ReactLynx dependency,
React plugin, or application entry. The output contains the named main script,
background script, and CSS sections; it is a resource, not a standalone page.

Follow the repository setup and full-build instructions, then run:

```sh
pnpm --filter @lynx-js/example-islands-producer dev
```

The resource is served at `http://127.0.0.1:3001/greeting.lynx.bundle`.
The [consumer](../islands-consumer) loads it from that URL.

Build this project independently through Turbo:

```sh
pnpm turbo build --filter @lynx-js/example-islands-producer
```

Publish the emitted bundle at a URL reachable from the host device. The consumer
only needs that URL and the expose name `greeting`.
