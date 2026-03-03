# Lynx Stack

This repository contains the **core JavaScript stack** of Lynx, including ReactLynx, Rspeedy, Lynx for Web, and testing utilities. This document provides essential information for coding agents to work efficiently with this codebase.

## Repository Overview

**What it does**: Lynx is a cross-platform application framework that enables developers to build applications with familiar React syntax that can run natively on mobile devices and web browsers. This repository contains the core runtime, build toolchain, web platform implementation, and testing infrastructure.

**Size & Structure**: Large monorepo with 49 packages, ~15MB of source code
**Languages**: TypeScript (primary), JavaScript, Rust (native bindings)
**Build System**: Turbo monorepo + pnpm workspaces
**Target Runtimes**: Node.js 22+, browsers, mobile devices

## Essential Build Commands

**ALWAYS follow this exact order for reliable builds:**

### 1. Initial Setup

```bash
# Install dependencies (required first)
npm install -g corepack
corepack enable
pnpm install --frozen-lockfile

# Verify toolchain
node --version  # Required
pnpm --version  # Required
rustc --version  # Required for native bindings
```

### 2. Building

```bash
# Full build (REQUIRED before running tests)
pnpm turbo build

# Development build with watching
pnpm turbo watch build
```

**⚠️ Critical**: Always run full build before tests. Watch mode only compiles TypeScript, not Rust components.

### 3. Code Quality

```bash
# Format code (ALWAYS run before committing)
pnpm dprint fmt

# Additional formatting check
pnpm biome check

# Linting (SLOW: 2+ minutes, run with adequate timeout)
pnpm eslint .

# Fix auto-fixable lint issues
pnpm eslint --fix .
```

### 4. Testing

```bash
# Run all tests (requires prior full build)
pnpm test

# Run tests for specific package
pnpm run test --project websocket

# Run tests for multiple packages
pnpm run test --project 'webpack/*'

# Test with coverage
pnpm run test --coverage

# Update test snapshots
pnpm run test --update
```

### 5. API Documentation

```bash
# Update API documentation (ALWAYS commit changes)
pnpm turbo api-extractor -- --local
```

### 6. Changesets (for contributions)

```bash
# Generate changeset for your changes
pnpm changeset

# Check changeset status (requires git remote origin/main)
pnpm changeset status --since=origin/main
```

## Common Build Issues & Solutions

**Issue**: Build fails with Rust compilation errors
**Solution**: Install/update Rust toolchain:

```bash
# Install Rust with wasm target
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
```

**Issue**: "API Report Changes Detected" error
**Solution**: Run API extractor and commit changes:

```bash
pnpm turbo api-extractor -- --local
git add packages/**/*.api.md
```

**Issue**: Tests fail with missing build artifacts
**Solution**: Always run full build first:

```bash
pnpm turbo build
pnpm test
```

**Issue**: Out of memory during build/test
**Solution**: Increase Node.js memory:

```bash
export NODE_OPTIONS="--max-old-space-size=32768"
```

## Project Architecture

### Core Packages

- `packages/react/` - **ReactLynx**: React-like framework for Lynx applications
  - `runtime/` - Core runtime implementation
  - `transform/` - Rust-based code transformations
  - `testing-library/` - Testing utilities for React components
  - `components/` - Built-in component library

- `packages/rspeedy/` - **Rspeedy**: Webpack/rspack-based build toolchain
  - `core/` - Main build tool implementation
  - `create-rspeedy/` - Project scaffolding tool
  - `plugin-*/` - Various build plugins

- `packages/web-platform/` - **Lynx for Web**: Web platform implementation
  - `web-core/` - Core web runtime
  - `web-elements/` - DOM element implementations
  - `web-worker-runtime/` - Web worker support
  - `web-tests/` - E2E test suite (Playwright)

- `packages/testing-library/` - Testing infrastructure
- `packages/tools/` - Build and development utilities
- `packages/webpack/` - Webpack plugins and tools

### Configuration Files

- `turbo.json` - Monorepo build orchestration
- `pnpm-workspace.yaml` - Workspace package definitions
- `tsconfig.json` - TypeScript configuration (strictest mode)
- `vitest.config.ts` - Test runner configuration
- `eslint.config.js` - Linting rules (complex, includes React/TS rules)
- `.dprint.jsonc` - Code formatting configuration
- `biome.jsonc` - Additional code quality rules
- `Cargo.toml` - Rust workspace configuration

## Validation Pipeline

The CI runs these checks (replicate locally for confidence):

1. **Code style**: `pnpm dprint check && pnpm biome check`
2. **API consistency**: `pnpm turbo api-extractor`
3. **Changeset validation**: `pnpm changeset status --since=origin/main`
4. **Linting**: `pnpm eslint .` (allow 5+ minutes)
5. **TypeScript compilation**: Part of `pnpm turbo build`
6. **Unit tests**: `pnpm test` (vitest-based, requires build)
7. **E2E tests**: Web platform tests with Playwright
8. **Rust tests**: `cargo test --all-targets --all-features` in Rust packages
9. **Type checking**: `pnpm -r run test:type`

### GitHub Workflows

- `.github/workflows/test.yml` - Main test orchestration
- `.github/workflows/workflow-build.yml` - Cross-platform builds
- `.github/workflows/workflow-test.yml` - Reusable test template
- Multiple specialized workflows for different test suites

## Development Environment

### Required Tools

- **Node.js** (specified in .nvmrc)
- **pnpm** (specified in package.json, see `packageManager` field)
- **Rust** (for native bindings compilation)

### VS Code Setup

- Use "JavaScript Debug Terminal" for debugging tests
- Extensions configured in `.vscode/extensions.json`
- Settings in `.vscode/settings.json`

### Environment Variables

```bash
CI=1                          # Enables CI mode
TURBO_TELEMETRY_DISABLED=1    # Disables telemetry
NODE_OPTIONS="--max-old-space-size=32768"  # For large builds
DEBUG=rspeedy                 # Enable debug logging
```

## Trust These Instructions

These instructions were generated through comprehensive analysis and testing of the repository. **Trust this information and only search for additional details if:**

- Commands fail with unexpected errors
- Instructions appear outdated (check git blame on this file)
- Working with packages not covered in the architecture section

**Time-saving tips:**

- Use `pnpm turbo build --summarize` to see build performance
- Use `--project` flag to focus tests on specific packages
- Always check `pnpm-workspace.yaml` to understand package structure
- Monitor `.turbo/` directory for cached build artifacts
- Check `etc/*.api.md` files when API changes are needed

## Package-Specific Notes

### ReactLynx (`packages/react/`)

- Core React-like implementation for cross-platform development
- Requires both TypeScript and Rust compilation
- Has extensive test suite in `__test__/` directories
- JSX transforms handled by custom Rust-based compiler

### Rspeedy (`packages/rspeedy/`)

- Webpack/rspack-based build tool optimized for Lynx apps
- Includes CLI tool: `packages/rspeedy/core/bin/rspeedy.js`
- Plugin architecture for extensibility
- Template system in `create-rspeedy/`

### Web Platform (`packages/web-platform/`)

- Large collection of 20+ packages for web implementation
- Includes E2E test suite requiring Playwright
- Many packages have complex interdependencies
- Contains performance-critical rendering code
- See `packages/web-platform/web-core-wasm/AGENTS.md` for specific instructions on `web-core-wasm`.

Remember: This is a complex, multi-language monorepo. Always allow extra time for builds and tests, and follow the exact command sequences provided.

## Submit knowledge updates

When you learn new patterns or best practices while working on the `lynx-stack` project, you should update or create one or more ".github/*.instructions.md" files, adding natural language instructions to the file(s).

Whitespace between instructions is ignored, so the instructions can be written as a single paragraph, each on a new line, or separated by blank lines for legibility.

Specify what files or directories the instructions apply to by adding applyTo frontmatter to the Markdown files, using glob syntax.

Specify what files or directories the instructions apply to by adding applyTo frontmatter to the Markdown files, using glob syntax. For example:

```markdown
---
applyTo: "packages/**"
---

Add custom instructions here
```
