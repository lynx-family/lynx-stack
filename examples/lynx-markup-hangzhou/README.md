# Lynx Markup: Hangzhou five-day trip

A browser example for the Lynx-specific `.xml` markup format supported by
`@lynx-js/web-core`. It demonstrates a zero-build Lynx page: an LLM directly
generates CSS, main-thread Element PAPI code, and background-thread code in one
`.xml` artifact, and the Web runtime parses that artifact when it loads.

Rsbuild only builds the browser host and copies `public/hangzhou-trip.xml`
unchanged. The Lynx page itself has no compilation step between LLM generation
and runtime loading.

## Run it

From the repository root:

```bash
pnpm --filter @lynx-js/example-lynx-markup-hangzhou dev
```

The Rsbuild host mounts a `<lynx-view>` whose URL is
`/hangzhou-trip.xml`. Tap any itinerary day to highlight it; the main thread
updates the Element PAPI tree and the background thread sends the confirmation
message displayed at the bottom of the card. Both scripts use
`lynx.getEngine()` to remove their listeners on `__DestroyLifetime`.

Build the static browser host with:

```bash
pnpm --filter @lynx-js/example-lynx-markup-hangzhou build
```
