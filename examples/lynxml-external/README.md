# LynXML external bundle on Android

`pluginLynx()` compiles the scripts and CSS in `math.lynxml`.
`defineExternalBundleRslibConfig` packages them as a native external bundle.
The main-thread module exports `add` and the background module exports `multiply`.

Build the example from the repository root and serve the output locally:

```sh
pnpm turbo build --filter=@lynx-js/example-lynxml-external
python3 -m http.server 3487 --bind 127.0.0.1 --directory examples/lynxml-external/dist
```

With an Android emulator running the open-source Lynx Explorer (`com.lynx.explorer`),
forward the port, then open the host. The host requires a runtime with LynXML support.

```sh
adb reverse tcp:3487 tcp:3487
adb shell am start -W -n com.lynx.explorer/.LynxViewShellActivity \
  --es lynx_initial_url 'http://127.0.0.1:3487/host.lynxml'
adb logcat -d | grep '\[lynxml-resource\]'
```

Both scripts in `public/host.lynxml` call `lynx.fetchBundle` and pass the
returned URL to `lynx.loadScript`. The main thread loads `math__main-thread` and
logs `main: add(6, 7) = 13`. The background thread loads `math` and logs
`background: multiply(6, 7) = 42`. The host adopts the `math:CSS` stylesheet from the same bundle and uses its
`.positive` class to display both results in green.
