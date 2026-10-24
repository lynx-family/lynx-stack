# Upstream Motion compatibility

Checked on 2026-10-24. This is a compatibility probe for the existing Lynx APIs,
not an upstream dependency upgrade or support for every new Motion feature.

| Package      | Shipped build input | Latest stable probe |
| ------------ | ------------------- | ------------------- |
| motion       | 13.4.3              | 14.6.0              |
| motion-dom   | 13.4.2              | 14.6.0              |
| motion-utils | 13.5.0              | 14.6.0              |

The npm `latest` tag resolves to 14.6.0, published on 2026-10-22. The upstream
changelog dates the release 2026-10-20; those are different release records.

## Relevant upstream changes

| Releases      | Changes since the pinned Motion version                                                                     | Lynx implication                                                            |
| ------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 13.4.4–13.4.7 | Spring validation and size improvements; animation and scroll fixes.                                        | Exercise springs and existing animation behavior.                           |
| 13.5.0–13.5.1 | Negative-bounce springs; corrected cleanup of replaced styleEffect bindings.                                | Both receive explicit latest-version checks.                                |
| 14.0          | Removed compatibility internals and pinned related packages together.                                       | Probe a matched dependency set.                                             |
| 14.1–14.2     | Vanilla layout animation, animation timing fixes, accelerated transforms, cubic-bezier improvements.        | Existing animation checks apply; new browser acceleration is not certified. |
| 14.3–14.4     | Grid/edge/random stagger, scaleZ, JavaScript drag.                                                          | New stagger options are tested; drag is not exposed by this adapter.        |
| 14.5–14.6     | Animation scopes, manual frame helpers, keyboard reordering, better tree shaking, and gesture/layout fixes. | New scope and frame APIs remain outside the public adapter.                 |

Sources: [official changelog](https://motion.dev/changelog?lib=motion),
[v14 upgrade guide](https://motion.dev/docs/upgrade-guide),
[14.6.0 release](https://github.com/motiondivision/motion/releases/tag/v14.6.0).

## Preset and selective imports

`build/pluginLynxRuntime.ts` takes no per-library replacement configuration.
`build/lynxRuntimePreset.ts` contains the supported predefined APIs:

- DOM: document, window, getComputedStyle.
- Constructors: Element, HTMLElement, SVGElement, NodeList, EventTarget.
- Timing: performance, queueMicrotask, requestAnimationFrame, cancelAnimationFrame.

ProvidePlugin selects dependencies from actual references during compilation.
DefinePlugin folds matching typeof expressions without requiring a runtime import.
The preset is independent of Motion exports or package versions. Runtime modules
are split by responsibility so a scheduler reference does not acquire the DOM
adapter. Dependencies of a selected implementation are still included: document
queries need the element wrapper; animation-frame fallback needs the clock.

The plugin currently lives inside the Motion package and expects vendor output
under `upstream/` with shipped private modules under `polyfill/`. It is not a
separately published general-purpose plugin package. Its selection tests use
ordinary JavaScript fixtures with no Motion dependency.

| Fixture                                  | Expected imported private modules             |
| ---------------------------------------- | --------------------------------------------- |
| No supported global referenced           | None                                          |
| queueMicrotask value reference           | microtask only                                |
| document query                           | dom only, plus its runtime element dependency |
| typeof queueMicrotask only               | None; compile-time constant                   |
| Locally shadowed document/queueMicrotask | None                                          |
| Unreachable false branch using document  | None                                          |

Static qualified, computed and optional accesses and all corresponding typeof
checks are covered. Dynamic property names and aliases of globalThis are not
claimed as supported. The preset is a list of implemented Lynx APIs, not a full
browser DOM shim; observers, browser layout trees, WAAPI and view transitions
need separate native implementations before being supported.

## Reproduce the latest-version probe

From the repository root, after installing dependencies and completing the required
full repository build:

```sh
pnpm install --frozen-lockfile
pnpm turbo build

export MOTION_COMPAT_ROOT="$(mktemp -d)"
npm install --prefix "$MOTION_COMPAT_ROOT" --ignore-scripts --no-audit --no-fund --save-exact motion@14.6.0 motion-dom@14.6.0 motion-utils@14.6.0
pnpm turbo build --env-mode=loose --filter @lynx-js/motion --only --force -- --config build/rslib.compat.config.ts

MOTION_TEST_DIST="file://$MOTION_COMPAT_ROOT/dist/" MOTION_TEST_HOST=absent MOTION_TEST_LATEST=true node packages/motion/__tests__/fixtures/compiled-features.mjs
MOTION_TEST_DIST="file://$MOTION_COMPAT_ROOT/dist/" MOTION_TEST_HOST=browser MOTION_TEST_LATEST=true node packages/motion/__tests__/fixtures/compiled-features.mjs
```

The opt-in build aliases only the vendor implementation graph to the selected
upstream installation. It writes into the temporary directory and preserves the
shipped version pins and normal dist. The adapter declarations are still generated
against the pinned build inputs; this probe does not certify an upgrade of public
types to 14.6.0.

The compiled suite exercises real animation code with a simulated Lynx element
host. Its existing 20 cases cover keyframes, sequences, colors, styles, playback,
cleanup, values, springs, and Mini's real spring/easing dependencies. Three opt-in
checks add grid/edge/random stagger, overdamped springs, and styleEffect rebinding.
Each host configuration runs in a separate process and verifies unchanged global
descriptors. These checks do not replace Android/iOS validation or establish
support for upstream APIs that this adapter does not export.

## Observed results

| Check                                         | Pinned inputs       | 14.6.0 inputs       |
| --------------------------------------------- | ------------------- | ------------------- |
| Library build                                 | Passed              | Passed              |
| Compiled features, absent globals             | 20/20               | 23/23               |
| Compiled features, read-only globals          | 20/20               | 23/23               |
| Full feature page in Chromium                 | 12/12               | 12/12               |
| Mini feature page in Chromium                 | 10/10               | 10/10               |
| Effect-started values page in Chromium        | 200px final height  | 200px final height  |
| Full, Mini and values page builds             | Lynx and Web passed | Lynx and Web passed |
| Example, Mini, Sheet and Tabs consumer builds | Lynx and Web passed | Lynx and Web passed |

No uncaught JavaScript errors were observed in the six Web feature pages. The
final preset implementation passes the full repository build (78 tasks), its
120-test Motion suite, plugin typechecking, formatting, and targeted linting.
Android/iOS were not exercised for this revision or the latest-version probe.

Using identical production consumer settings and the same preset, the version
probe produces these application bundle sizes (bytes; maps excluded):

| Consumer     | Target | Pinned inputs | 14.6.0 inputs | Difference |
| ------------ | ------ | ------------: | ------------: | ---------: |
| Full example | Lynx   |       230,356 |       244,911 |     +6.32% |
| Full example | Web    |       209,465 |       221,153 |     +5.58% |
| Mini         | Lynx   |       130,554 |       130,995 |     +0.34% |
| Mini         | Web    |       125,900 |       126,199 |     +0.24% |
| Sheet        | Lynx   |       187,250 |       187,700 |     +0.24% |
| Sheet        | Web    |       182,929 |       183,228 |     +0.16% |
| Tabs         | Lynx   |       205,891 |       206,347 |     +0.22% |
| Tabs         | Web    |       204,306 |       204,605 |     +0.15% |

These numbers compare upstream versions under the same build, not the old global
polyfill format against the new private-runtime format. The production package
keeps its existing upstream versions; the latest-version results are a probe.
