# Lynx XML Prompt

Keep this package headless. It owns prompt construction for complete,
zero-build `.lynxml` artifacts; model providers, agent runtimes, streaming,
artifact extraction, and preview rendering belong in their consuming packages.

Use the pinned direct dependency on `@lynx-js/skill-vanilla-lynx` as the source
of truth for shared Vanilla Lynx runtime guidance. Import selected Markdown
sections with `?raw` in `src/vanilla-lynx-skill.ts` and inline them during the
Rslib build. Do not read skill files from the filesystem at runtime, publish
separate Markdown assets, or copy their shared prose into `src/prompt.ts`.
When adding a selected reference, update the matching Rslib and Rstest raw-asset
rules, keep the skill package in Rstest's `output.bundleDependencies`, and add a
composition test.

Keep only Lynx XML and GenUI-specific overrides in the local prompt. Preserve
the single-file, zero-build boundary by filtering Rspeedy and external-bundle
instructions. Do not reintroduce `globalThis.processData` as a required prompt
contract without an explicit product decision. Require the page root and every
container that lays out Element children to use an applied class with explicit
`display: flex` and `flex-direction`; generated artifacts must not rely on
Lynx's default Linear layout. These local rules take precedence over the
imported skill guidance. Keep numeric component ids separate from Element PAPI
node references: every `__AppendElement` argument must be a node, helpers that
append must receive parent nodes rather than ids, and `pageId` is reserved for
page-owned element creation APIs.

Keep mobile design defaults in `src/mobile-design.ts`. Base them on the current
Lynx responsive, page, Flex, scroll-view, and accessibility documentation.
Preserve a narrow-portrait, single-primary-scroll baseline; safe-area insets
must be applied once per exposed edge, fixed bars must reserve scroll content
space, and tappable controls must be at least 44px by 44px. Keep Element PAPI
names, attributes, and concrete scroll-view tree rules out of
`src/mobile-design.ts`; maintain them in the Lynx XML adaptation contract in
`src/prompt.ts`. When content can exceed one viewport, that contract must make
the definite-height vertical `scroll-view` the first business node appended
directly to the Page, without a business `view` wrapper. User-provided design
systems may override visual defaults but not runtime, layout, safe-area, or
accessibility requirements.

Check the current Vanilla Lynx skill and Lynx API documentation before changing
the selected sections, runtime overrides, or CSS guidance.

The GenUI server must import the prompt from this package instead of maintaining
a second prompt string. Add prompt behavior through `buildLynxXmlSystemPrompt`
rather than concatenating server-only fragments into the default constant.

Run the package build and tests after prompt or API changes. Verify that the
built JavaScript contains the selected guidance and has no runtime Markdown
imports. Update the prompt contract tests whenever the dependency selection or
a required local invariant changes.
