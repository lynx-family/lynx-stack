# A2UI CLI

`@lynx-js/a2ui-cli` provides one command line entry point for A2UI agent setup.
It can generate catalog artifacts from TypeScript catalog definitions and build
a system prompt for an A2UI generation agent.

## Usage

Generate a system prompt with the built-in A2UI basic catalog:

```bash
npx @lynx-js/a2ui-cli generate prompt --out dist/a2ui-system-prompt.txt
```

Generate catalog artifacts for a custom catalog:

```bash
npx @lynx-js/a2ui-cli generate catalog \
  --catalog-dir src/catalog \
  --source src/functions \
  --out-dir dist/catalog
```

Generate a system prompt for a custom catalog:

```bash
npx @lynx-js/a2ui-cli generate prompt \
  --catalog-dir dist/catalog \
  --catalog-id https://example.com/catalogs/custom/v1/catalog.json \
  --out dist/a2ui-system-prompt.txt
```

`generate prompt` uses the built-in A2UI basic catalog by default. Pass
`--catalog-dir` only when generating a prompt for custom generated catalog
artifacts. When `--catalog-dir` is provided, the directory must contain files
like `<Component>/catalog.json`.

## Commands

### `generate catalog`

Uses the internal `@lynx-js/a2ui-catalog-extractor` engine. Keep user-facing
scripts on `npx @lynx-js/a2ui-cli generate catalog`.

Useful options:

- `--catalog-dir <dir>`: directory to scan for TypeScript component catalog
  interfaces. Defaults to `src/catalog`.
- `--source <path>`: source file or directory to scan for catalog functions.
  Repeatable.
- `--typedoc-json <file>`: read an existing TypeDoc JSON project.
- `--out-dir <dir>`: output directory for generated catalog artifacts. Defaults
  to `dist/catalog`.

### `generate prompt`

Delegates prompt construction to `@lynx-js/a2ui-prompt`.

Useful options:

- `--catalog-dir <dir>`: generated catalog artifact directory. Omit this option
  to use the built-in A2UI basic catalog.
- `--catalog-id <id>`: catalog id to require in `createSurface` messages.
  Defaults to the built-in A2UI basic catalog id.
- `--out <file>`: write the prompt to a file instead of stdout.
- `--appendix <text>`: append extra instructions to the generated prompt.
