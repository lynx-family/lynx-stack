# Independent Island consumer

This ReactLynx host loads the `greeting` module from an absolute bundle URL.
It does not use the Islands build plugin, import the producer's XML, or depend
on the producer package. The producer can be built and deployed independently.

Follow the repository setup and full-build instructions. Start the
[producer](../islands-producer) in one terminal and the consumer in another:

```sh
pnpm --filter @lynx-js/example-islands-consumer dev
```

Open `http://127.0.0.1:3000/main.lynx.bundle` in Lynx Explorer. For a physical
device, set `LYNX_HOST` to the development machine's reachable address.
For a remote deployment, set `ISLAND_ENTRY` to the published resource URL.

```sh
ISLAND_ENTRY=https://example.com/greeting.lynx.bundle pnpm turbo build --filter @lynx-js/example-islands-consumer
```

The card appears after the remote resource loads. Update greeting changes its
props and invokes the remote background script. Unmount disposes its instance;
Mount creates a new instance. Rapid updates and unmounting during a fetch must
not resurrect old instances.

Lynx SDK 3.7 or newer is required. Remote content shares the host Page, runtime,
and page stylesheet scope.
