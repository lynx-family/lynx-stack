---
applyTo: "packages/genui/cli/**"
---

The CLI ships inside `@lynx-js/genui`; the public tarball does not include `cli/package.json`. Read the umbrella package manifest for both CLI version output and generated-template dependency versions. Preview versions must produce pkg.pr.new URLs instead of npm semver ranges, preserving explicit React preview dependencies. Test built CLI files in an isolated umbrella package layout without workspace symlinks. For pnpm 11 previews, print a command-scoped blockExoticSubdeps override rather than changing global package-manager settings.
