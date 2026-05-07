---

---

Add a new `examples/react-lazy-bundle-standalone` example demonstrating a split producer/consumer setup for ReactLynx lazy bundles, with two `rspeedy` instances (consumer proxies `/producer` to the producer). Provides aggregate `dev`/`build`/`preview` scripts: `build` runs the two configs in parallel via pnpm, while `dev`/`preview` go through `scripts/serve.mjs` so the consumer keeps the TTY for the QR code while the producer's logs stream in the background. No package release is required.
