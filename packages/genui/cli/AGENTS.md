# GenUI CLI

Keep this package as the single public CLI entry point for GenUI setup. It should
orchestrate other packages instead of implementing catalog extraction, prompt
construction, or future OpenUI workflows itself.

Use namespace-first commands. A2UI commands live under `genui a2ui ...`; future
OpenUI commands should live under `genui openui ...`.

`genui a2ui generate catalog` should delegate to
`@lynx-js/genui/a2ui-catalog-extractor`. `genui a2ui generate prompt` should
delegate to `@lynx-js/genui/a2ui-prompt`.

Do not require users to pass `--catalog-dir` for the common prompt path. A prompt
without `--catalog-dir` should use the built-in A2UI basic catalog from
`@lynx-js/genui/a2ui-prompt`; use `--catalog-dir` only for custom generated catalog
artifacts.

When `--catalog-dir` is provided, empty catalog directories should fail clearly
instead of producing a prompt with an empty component catalog.

The executable file is `bin/cli.js`; keep `package.json` `bin.genui`,
`bin.genui-cli`, and compatibility `bin.a2ui-cli` pointed at that path.

When testing local CLI changes, run the bin directly with Node. If testing
changes in `@lynx-js/genui/a2ui-prompt`, rebuild that package first because this CLI
imports it through package exports.
