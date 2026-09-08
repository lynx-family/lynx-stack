# @lynx-js/zip-rsbuild-plugin

Package a production build as a ZIP accepted by [Lynx UI Judge](../../genui/ui-judge/README.md).

## Usage

This package is private and is not published to npm. Add it to a package in this
repository's workspace:

```sh
pnpm add -D @lynx-js/zip-rsbuild-plugin@workspace:*
```

Add it to your existing Rspeedy plugins:

```ts
import { defineConfig } from '@lynx-js/rspeedy'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { pluginZip } from '@lynx-js/zip-rsbuild-plugin'

export default defineConfig({
  plugins: [pluginReactLynx(), pluginZip()],
})
```

Run `rspeedy build`. For production builds, the plugin sets `output.assetPrefix`
and Rspack's `output.publicPath` to `zip:///`, archives the output files, and
replaces the contents of `dist` with `dist/dist.zip`. The output directory stays
in place so `rspeedy preview` can find it. A custom `output.distPath.root` works
the same way. Environment output directories must be inside that root.

The archive contains the contents of the output directory, without a wrapping
`dist/` folder. Entrypoint names stay unchanged, such as `main.lynx.bundle`.
Emitted chunks, images, source maps, copied files, and public assets are included.
Imported assets use archive URLs; write manually referenced public assets as
`zip:///images/logo.png` or paths relative to the entrypoint.

`rspeedy dev`, including `rspeedy dev --mode production`, keeps its original
assets and URLs. Builds with `mode: 'development'` or `mode: 'none'` also keep
their original outputs.

## Preview and capture

Run `rspeedy preview` to serve the ZIP. The printed URL points to the archive.
`server.base` is preserved.
Preview serves the ZIP for download; UI Judge renders an entry inside it.

Upload the built archive to a local UI Judge server:

```sh
curl http://127.0.0.1:8080/screenshot/zip/upload \
  --form 'file=@dist/dist.zip;type=application/zip' \
  --form-string 'entry=main.lynx.bundle' \
  --output screenshot.bmp
```

For a deployed archive, use `/screenshot/zip/url` with a public HTTP(S) URL.
UI Judge's remote downloader rejects loopback and private network addresses,
so use the upload endpoint for a local preview download.

## Options and limits

`pluginZip({ filename: 'page.zip' })` changes the output to `dist/page.zip`.
The filename must end in `.zip` and cannot contain directory components.
Reserve this filename for the plugin.

The plugin generates classic ZIP archives and enforces UI Judge's limits:
10 MiB per archive, 100 files, 50 MiB per file, 100 MiB uncompressed in total,
20 path components, 255 UTF-8 bytes per component, and 4096 bytes per path.
Files whose DEFLATE compression ratio would exceed 100:1 are stored uncompressed.
Symlinks and special files in the output are rejected. Validation failures leave
the unpacked output available for inspection.
