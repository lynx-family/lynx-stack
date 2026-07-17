# Output Files

This chapter will introduces the directory structure of output files and how to control the output directory of different types of files.

## Default Directory Structure

The following is a basic directory for output files. By default, the compiled files will be output in the `dist` directory of current project.

### Production

In production, the `dist/` directory contains all the files that need to be deployed.

```
dist/
├── [name].lynx.bundle
├── lazy-bundle
│   └── [name].[fullhash].bundle
└── static
    ├── image
    │   └── [name].[hash].png
    └── svg
        └── [name].[hash].svg
```

The most common output files are Bundle files, JS files and static assets:

- Bundle files(`[name].lynx.bundle`), which can be configured with [`output.filename.bundle`].
- Lazy bundle files(`lazy-bundle/[name].[fullhash].bundle`).
- JS files(`static/js/*.js`), only emitted when [`output.inlineScripts`] is disabled, which can be configured with [`output.distPath.js`] and [`output.filename.js`].
- Static assets(`static/{font,image,media,svg}`) directory.

In the filename, `[name]` is the entry name corresponding to this file, such as `index`, `main`. `[hash]` is the hash value generated based on the content of the file. `[id]` is the internal chunk ID of Rspack.

### Development

In development, an `dist/.rspeedy` directory is emitted which contains the resources for debugging.

```
dist/
├── .rspeedy
│   ├── lazy-bundle
│   │   └── [name]
│   │       ├── background.js
│   │       ├── background.css
│   │       ├── background.css.hot-update.json
│   │       ├── debug-metadata.json
│   │       ├── main-thread.js
│   │       └── tasm.json
│   └── [name]
│       ├── background.js
│       ├── debug-metadata.json
│       ├── main-thread.js
│       ├── [name].css
│       ├── [name].css.hot-update.json
│       └── tasm.json
├── [name].lynx.bundle
├── lazy-bundle
│   └── [name].[fullhash].bundle
└── static
    ├── image
    │   └── [name].[hash].png
    └── svg
        └── [name].[hash].svg
```

In addition, Rspeedy generates some extra files in development:

- Background Thread Script(BTS): The background script file that is inlined into the bundle, default output to `.rspeedy/[name]/background.js`.
- MainThread Thread Script(MTS): The main-thread script file that is inlined into the bundle, default output to `.rspeedy/[name]/main-thread.js`.
- Source Map files: contains the source code mappings, which is output to the same level directory of JS files and adds a `.map` suffix when [`output.sourceMap`] is enabled.

## Modify the Directory

Rspeedy provides some configs to modify the directory or filename, you can:

- Modify the filename through [`output.filename`].
- Modify the output path of through [`output.distPath`].
- Modify the license file through [`output.legalComments`].
- Modify Source Map file through [`output.sourceMap`].

## Flatten the Directory

Sometimes you don't want the dist directory to have too many levels, you can set the directory to an empty string to flatten the generated directory.

See the example below:

```js
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  output: {
    distPath: {
      js: '',
    },
    filename: {
      bundle: '[name].lynx.bundle',
    },
  },
});
```

The above config produces the following directory structure:

```bash
dist
├── [id].[hash].js
├── [id].[hash].js.map
└── [name].lynx.bundle
```

[`output.filename`]: /api/rspeedy.output.filename
[`output.inlineScripts`]: /api/rspeedy.output.inlinescripts
[`output.filename.js`]: /api/rspeedy.filename.js
[`output.filename.bundle`]: /api/rspeedy.filename.bundle
[`output.distPath`]: /api/rspeedy.output.distpath
[`output.distPath.js`]: /api/rspeedy.distpath.js
[`output.legalComments`]: /api/rspeedy.output.legalcomments
[`output.sourceMap`]: /api/rspeedy.output.sourcemap
