# @lynx-js/debug-metadata-rsbuild-plugin

## 0.2.2

### Patch Changes

- Accept `DEBUG=lynx` (and `lynx:*`, `lynx:template`) for the Lynx debug output and intermediates. It is the recommended form now that the plugins also run under Rslib and Rsbuild; `DEBUG=rspeedy` keeps working. ([#3735](https://github.com/lynx-family/lynx-stack/pull/3735))

- Declare the build host as an optional peer dependency. `@rsbuild/core` covers a plain Rsbuild build, and `@lynx-js/rspeedy` covers an Rspeedy one, so whichever host is installed is version-checked. ([#3678](https://github.com/lynx-family/lynx-stack/pull/3678))

- File each main thread chunk's bytecode debug info under the artifact it was compiled from, and name that artifact after the section carrying it. A bundle whose main thread code lives in `JsBytecode` custom sections had every unit the encoder produced piled onto its first main thread artifact, keyed by section name, while the other entries got none; each artifact was also reported as the file it was assembled from, `<name>.js`, rather than the `<name>` a stack frame carries. ([#3776](https://github.com/lynx-family/lynx-stack/pull/3776))

## 0.2.1

### Patch Changes

- Skip `debug-metadata.json` emission on local production builds — nothing reads it there, but collecting it walks every source map. Production builds now emit it only on an automated build, detected via `CI`, `CI_REPO_NAME` or `BUILD_VERSION`; `DEBUG=rspeedy` opts back in. Dev builds are unaffected. ([#3007](https://github.com/lynx-family/lynx-stack/pull/3007))

- Reduce build-time overhead: memoize the chunk release key, and read the commit and worktree root in one `git rev-parse` spawn instead of two. ([#3008](https://github.com/lynx-family/lynx-stack/pull/3008))

## 0.2.0

### Minor Changes

- Keep lazy bundle source maps in `debug-metadata.json` now that async chunk groups are unnamed: the collectors resolve a bundle's chunk groups from the files its encode data enumerates instead of looking them up by chunk-group name. ([#2961](https://github.com/lynx-family/lynx-stack/pull/2961))

### Patch Changes

- Minify `debug-metadata.json` to avoid invalid string length when development large projects ([#2966](https://github.com/lynx-family/lynx-stack/pull/2966))

## 0.1.2

### Patch Changes

- fix(debug-metadata): register the background-thread release inside the bundle wrapper, keeping the legacy source-map release authoritative during the transition ([#2891](https://github.com/lynx-family/lynx-stack/pull/2891))

## 0.1.1

### Patch Changes

- Stop emitting `debug-metadata.json` in production builds unless `DEBUG=rspeedy`. Previously an `RSDOCTOR=true` build leaked the file into the output, because `LynxEncodePlugin`'s intermediate-asset cleanup is skipped under Rsdoctor (it keeps intermediate files split so Rsdoctor can analyse them). The debug-metadata plugin now strips the asset itself. Dev builds keep it in memory so the debug-metadata middleware can still serve it. ([#2850](https://github.com/lynx-family/lynx-stack/pull/2850))

## 0.1.0

### Minor Changes

- Add unified `debug-metadata.json` per Lynx entry. ([#2642](https://github.com/lynx-family/lynx-stack/pull/2642))

  - New `@lynx-js/debug-metadata` schema package (zero-dep).
  - New `@lynx-js/debug-metadata-rsbuild-plugin` emits the file and serves `?field=…` queries in dev.
  - JS `//# sourceMappingURL=` and tasm `templateDebugUrl` repointed at the new endpoint.
  - `debug-info.json` no longer written to disk.
  - Auto-registered by Rspeedy — zero user config.

- ([#2760](https://github.com/lynx-family/lynx-stack/pull/2760))

### Patch Changes

- ([#2752](https://github.com/lynx-family/lynx-stack/pull/2752))

- Updated dependencies [[`a839d59`](https://github.com/lynx-family/lynx-stack/commit/a839d59b7f477a86f2cd10215d0b754264e54425), [`d3201df`](https://github.com/lynx-family/lynx-stack/commit/d3201dfa57964bfe6c8c52a803aeeb0fca1f2d27), [`409594b`](https://github.com/lynx-family/lynx-stack/commit/409594b9c51bb0c13f01c7d3f16949b27ebfdced), [`353363e`](https://github.com/lynx-family/lynx-stack/commit/353363e52dca3b252b39b34a3a87ce840dd308f3)]:
  - @lynx-js/debug-metadata@0.1.0
