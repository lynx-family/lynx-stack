---
applyTo: ".changeset/*.md"
---

Changesets must target publishable packages. With `privatePackages.version: false`,
private workspace packages are ignored even when absent from the explicit `ignore`
list; do not combine them with publishable packages in one changeset. OpenUI code
under the private `@lynx-js/genui-openui` workspace is published through
`@lynx-js/genui`, so record its release changes against `@lynx-js/genui`.
