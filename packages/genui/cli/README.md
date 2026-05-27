# GenUI CLI

`@lynx-js/genui-cli` is the command line entry point for GenUI workflows. It is
structured by namespace so A2UI commands can live beside future OpenUI commands
without adding another package or binary.

## Usage

```bash
genui <namespace> <command> [options]
```

Available namespaces:

- `a2ui`: generate A2UI catalog artifacts and system prompts.
- `openui`: reserved for future OpenUI workflows.

The package also exposes `genui-cli` as an alias. `a2ui-cli` remains available as
a compatibility alias for existing A2UI-only scripts.

## A2UI Commands

Generate a system prompt with the built-in A2UI basic catalog:

```bash
genui a2ui generate prompt --out dist/a2ui-system-prompt.txt
```

Generate catalog artifacts for a custom catalog:

```bash
genui a2ui generate catalog \
  --catalog-dir src/catalog \
  --source src/functions \
  --out-dir dist/catalog
```

Generate a system prompt for a custom catalog:

```bash
genui a2ui generate prompt \
  --catalog-dir dist/catalog \
  --catalog-id https://example.com/catalogs/custom/v1/catalog.json \
  --out dist/a2ui-system-prompt.txt
```

`generate prompt` uses the built-in A2UI basic catalog by default. Pass
`--catalog-dir` only when generating a prompt for custom generated catalog
artifacts. When `--catalog-dir` is provided, the directory must contain files
like `<Component>/catalog.json`.

### `genui a2ui generate catalog`

Delegates catalog extraction to `@lynx-js/genui/a2ui-catalog-extractor`.

Useful options:

- `--catalog-dir <dir>`: directory to scan for TypeScript component catalog
  interfaces. Defaults to `src/catalog`.
- `--source <path>`: source file or directory to scan for catalog functions.
  Repeatable.
- `--typedoc-json <file>`: read an existing TypeDoc JSON project.
- `--out-dir <dir>`: output directory for generated catalog artifacts. Defaults
  to `dist/catalog`.

### `genui a2ui generate prompt`

Delegates prompt construction to `@lynx-js/genui/a2ui-prompt`.

Useful options:

- `--catalog-dir <dir>`: generated catalog artifact directory. Omit this option
  to use the built-in A2UI basic catalog.
- `--catalog-id <id>`: catalog id to require in `createSurface` messages.
  Defaults to the built-in A2UI basic catalog id.
- `--out <file>`: write the prompt to a file instead of stdout.
- `--appendix <text>`: append extra instructions to the generated prompt.

## Compatibility

Existing A2UI commands still work:

```bash
a2ui-cli generate catalog --catalog-dir src/catalog --out-dir dist/catalog
a2ui-cli generate prompt --out dist/a2ui-system-prompt.txt
```

New scripts should prefer `genui a2ui ...`.
