# LynXML external bundle with a ReactLynx host

Rslib builds `math.lynxml` into the resource bundle `math.lynx.bundle`.
Rsbuild builds the ReactLynx page, `host.lynx.bundle`. Both bundles are emitted
in `dist/`. The page fetches the resource, calls `multiply` on the
background thread and `add` on the main thread, and adopts the `math:CSS`
stylesheet. Both results, 42 and 13, appear in green.

## Run in Android Lynx Explorer

From the repository root, forward a port to the Android device and start the
example. Use the same port when opening the page in Explorer.

```sh
export PORT=3487
adb reverse "tcp:$PORT" "tcp:$PORT"
pnpm --filter @lynx-js/example-lynxml-external dev
```

In another terminal:

```sh
PORT=3487
adb shell am start -W -n com.lynx.explorer/.LynxViewShellActivity \
  --es lynx_initial_url "http://localhost:$PORT/host.lynx.bundle"
```

For a production build, run `pnpm --filter @lynx-js/example-lynxml-external build`
and serve `examples/lynxml-external/dist` on the selected port.
The ReactLynx host uses `source.define` to inject the absolute math bundle URL.
The default uses `localhost` and `PORT` for `adb reverse`. Set
`LYNXML_MATH_BUNDLE_URL` before building or starting the dev server to load the
resource from another server or directory.
