<p align="center">
  <a href="https://lynxjs.org/rspeedy" target="blank"><img src="https://lf-lynx.tiktok-cdns.com/obj/lynx-artifacts-oss-sg/lynx-website/assets/rspeedy-banner.png" alt="Rspeedy Logo" /></a>
</p>

# create-rspeedy

Create a new Rspeedy x ReactLynx project.

Using `npm create`:

```bash
npm create rspeedy@latest
```

Using CLI flags:

```bash
npx create-rspeedy --dir my-project

# Using abbreviations
npx create-rspeedy -d my-project
```

## Using Custom Templates

### NPM Package Templates

You can use any npm package as a template:

```bash
# Using npm package name
npm create rspeedy@latest my-project -- --template my-template-package

# Using scoped package
npm create rspeedy@latest my-project -- --template @scope/template-package

# Using explicit npm: prefix
npm create rspeedy@latest my-project -- --template npm:my-template-package

# With specific version
npm create rspeedy@latest my-project -- --template my-template-package --template-version 1.2.3
```

### Template Package Structure

Your npm template package should have one of the following structures:

```
my-template-package/
├── template/              # Preferred
│   ├── package.json
│   ├── src/
│   └── ...
├── templates/
│   └── app/              # Alternative
│       ├── package.json
│       └── ...
└── (root)                # Fallback
    ├── package.json
    └── ...
```

### Template Caching

- Templates with `latest` version are always re-installed
- Specific versions are cached in `.temp-templates/` for faster reuse

## Documentation

https://lynxjs.org/rspeedy

## Contributing

Please read the [Contributing Guide](https://github.com/lynx-family/lynx-stack/blob/main/CONTRIBUTING.md).

## License

Rspeedy is [Apache-2.0 licensed](https://github.com/lynx-family/lynx-stack/blob/main/LICENSE).
