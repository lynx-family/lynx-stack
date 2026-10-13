# Headless default font

The pinned Linux Lynx runtime (`lynx-runtime-clay-manual-0.0.4`) scans
`/usr/share/fonts/` with Skia's directory font manager. It does not use
Fontconfig aliases, and its character fallback implementation returns no match.

The root Dockerfile moves any original font directory to
`/usr/share/fonts.original` and exposes only the standalone `Noto Sans CJK SC`
Regular font in `/usr/share/fonts/`. With the preferred Western families absent,
the directory manager can select this family as its default. A standalone
Simplified Chinese OTF avoids the multiple regional families in the Noto TTC
package. Default Latin text also uses Noto, so text widths and wrapping can
change. This does not add automatic fallback for other scripts or provide
dedicated bold and italic faces.

## Font source

- Source: https://github.com/notofonts/noto-cjk/blob/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf
- SHA-256: `2c76254f6fc379fddfce0a7e84fb5385bb135d3e399294f6eeb6680d0365b74b`
- Copyright: 2014–2021 Adobe.
- License: SIL Open Font License 1.1, included in `LICENSE.txt` and copied into the image.

## Validation

Build from the repository root:

```bash
docker build --platform linux/amd64 -t lynx-stack:cjk .
```

Start `ui-judge-server` in the image with the environment variables described in
the [screenshot storage setup](../../packages/genui/ui-judge/README.md#screenshot-storage).

The build checks the installed font's internal family name with `fc-scan`.
This checks the resource, not Lynx's font selection. Submit a LynXML page
containing `你好, Lynx!` to `/screenshot/lynxml` without setting `font-family`,
following the [UI Judge HTTP API](../../packages/genui/ui-judge/README.md#http-server).
Open the screenshot at the returned URL and confirm that it contains Chinese glyphs rather than
missing-glyph boxes. `fc-match` is not an end-to-end check for this runtime.
