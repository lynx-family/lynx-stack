---

---

Add a new `examples/react-lazy-bundle-standalone` example demonstrating a split producer/consumer setup for ReactLynx lazy bundles, with two `rspeedy` dev servers (consumer proxies `/producer` to the producer) and a small `node scripts/dev.mjs` runner so the consumer keeps the TTY for the QR code while the producer streams logs in the background. No package release is required.
