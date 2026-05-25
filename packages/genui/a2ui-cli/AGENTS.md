# a2ui-cli

Keep this package as the single public CLI entry point for A2UI setup. It should
orchestrate other packages instead of implementing catalog extraction or prompt
construction itself.

`generate catalog` should delegate to `@lynx-js/a2ui-catalog-extractor`.
`generate prompt` should delegate to `@lynx-js/a2ui-prompt`.

Do not require users to pass `--catalog-dir` for the common prompt path. A prompt
without `--catalog-dir` should use the built-in A2UI basic catalog from
`@lynx-js/a2ui-prompt`; use `--catalog-dir` only for custom generated catalog
artifacts.

When `--catalog-dir` is provided, empty catalog directories should fail clearly
instead of producing a prompt with an empty component catalog.

The executable file is `bin/cli.js`; keep `package.json` `bin.a2ui-cli` pointed
at that path.

When testing local CLI changes, run the bin directly with Node. If testing
changes in `@lynx-js/a2ui-prompt`, rebuild that package first because this CLI
imports it through package exports.
