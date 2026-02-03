# Web Core WASM

This package (`packages/web-platform/web-core-wasm`) is the high-performance core of the Lynx Web Platform, implemented primarily in Rust and compiled to WebAssembly (WASM). It handles computation-intensive tasks and facilitates the interaction between the Lynx runtime and the browser DOM.

## Overview

The `web-core-wasm` package bridges the gap between Lynx's native-like architecture and the web platform. Its primary responsibilities include:

1. **CSS Processing**: High-performance tokenization and transformation of Lynx-specific CSS (e.g., `rpx` units, `linear` layout) into standard Web CSS.
2. **Template Management**: efficient binary serialization (`encode`) and deserialization (`decode`) of style templates using `rkyv`.
3. **Main Thread Runtime**: Managing the state of Lynx elements, DOM manipulation, and event handling on the main thread.
4. **Background Thread Service (BTS)**: Hosting the Lynx logic (React/JavaScript) in a Web Worker to ensure UI responsiveness.

## Architecture & Modules

The codebase is structured into three main layers: the **Rust Core** (`src`), the **Client Runtime** (`ts/client`), and the **Encoder** (`ts/encode`).

### 1. Rust Core (`src`)

The Rust code forms the logic backbone, compiled into WASM.

- **`main_thread`**: The core runtime logic.
  - **`MainThreadWasmContext`**: The central state holder. It manages the DOM tree, element metadata, template instances, and event configuration.
  - **`element_apis`**: Implements the logic for manipulating elements.
    - **`element_data.rs`**: Stores per-element metadata (`LynxElementData`), including CSS IDs, component IDs, and datasets.
    - **`event_apis.rs`**: Handles event registration and dispatching (both standard events and "worklet" events).
    - **`style_apis.rs`**: Provides style manipulation APIs, utilizing `CSSProperty::from_id`.
  - **`js_binding`**: Defines the `RustMainthreadContextBinding` to expose these Rust methods to JavaScript.

- **`css_tokenizer`**: A CSS tokenizer ported from `css-tree`, fully compliant with CSS Syntax Level 3.
- **`style_transformer`**: Transforms Lynx CSS into Web CSS using the strongly-typed `CSSProperty` enum for efficiency. Handles `rpx` unit resolution (via `token_transformer`) and complex property rules.
- **`template`**: Defines the schema for binary templates (`RawStyleInfo`) and handles their `rkyv` serialization.
  - **`css_property.rs`**: Defines the `CSSProperty` enum (u16 IDs) and shared `ParsedDeclaration` struct. Uses `rkyv` instead of `serde`. Unknown properties are treated homogeneously.
- **`leo_asm`**: Defines "Leo Assembly" opcodes (e.g., `CreateElement`, `SetAttribute`) used to efficiently reconstruct DOM trees from templates.
- **`utils`**: General purpose utilities.
  - **`hyphenate_style_name.rs`**: Converts camelCase style names to kebab-case (e.g., `backgroundColor` -> `background-color`). **Note**: Assumes no `ms` vendor prefix.

### 2. Client Runtime (`ts/client`)

TypeScript bindings that load the WASM module and build the browser environment.

#### Main Thread (`ts/client/mainthread`)

Handles DOM rendering and user interaction.

- **`LynxView.ts`**: The `<lynx-view>` custom element. It initializes the `LynxViewInstance` and acts as the entry point.
- `ts/client/mainthread/TemplateManager.ts`: Manages template loading and processing. a dedicated `decode.worker.js` to parse binary templates off-main-thread.
- `src/template/template_sections/style_info`: Contains style information modules (`raw_style_info.rs`, `css_property.rs`, `style_info_decoder.rs`) which define the schema and decoding logic for styles.
- `src/main_thread/style_manager.rs`: Manages styles, handles CSS selector logic and CSS OG style updates.
- **`elementAPIs/createElementAPI.ts`**: A JavaScript facade over the Wasm `MainThreadWasmContext`. It provides methods like `__CreateElement` and `__SetAttribute` that bridge JS calls to the underlying Rust logic.
- **`elementAPIs/WASMJSBinding.ts`**: Mocks or proxies the Wasm binding for testing or non-Wasm environments.

#### Background Thread (`ts/client/background`)

Runs the application logic (BTS).

- **`startBackgroundThread.ts`**: Bootstraps the background worker, establishing RPC with the main thread.
- **`createNativeApp.ts`**: Creates the `NativeApp` interface, which mimics the native Lynx environment for the application code. It proxies commands (like `createElement`) to the main thread via RPC.
- **`createBackgroundLynx.ts`**: Sets up the global `lynx` object in the worker.

### 3. Server Runtime (`ts/server`)

TypeScript bindings for Server-Side Rendering (SSR).

- **`wasm.ts`**: Loads the server-specific Wasm binary.
- **`elementAPIs/createElementAPI.ts`**: Implements `ElementPAPIs` for the server, using `MainThreadServerContext` to generate HTML strings instead of manipulating DOM.

### 4. Encoder (`ts/encode`)

Build-time utilities.

- **`encodeCSS.ts`**: Uses the `encode` feature of the Wasm module to serialize CSS ASTs into binary format during the build process.

## Data Flow

### 1. Template Loading & Rendering

1. **Fetch**: `TemplateManager` fetches the binary template bundle.
2. **Decode**: The bundle is sent to `decode.worker.js`, where it is parsed into `ElementTemplateSection`s.
3. **Render**: `LynxViewInstance` receives the decoded data.
4. **Assembly**: The Wasm core executes `leo_asm` opcodes to construct the actual DOM nodes via `createElementAPI`.

### 2. Event Handling

1. **User Action**: User interacts with a DOM element (e.g., click).
2. **Dispatch**: The event is captured by the main thread listener.
3. **Routing**:
   - If it's a **Worklet** event, it's processed on the Main Thread.
   - If it's a **BTS** (standard) event, it's sent via RPC to the Background Thread to trigger the React/JS handler.

## Development & Build

This package uses a hybrid build system involving `pnpm`, `rsbuild`, and `cargo`.

### Scripts

- **`pnpm build`**: Runs `scripts/build.js`.
  1. Compiles Rust to Wasm (`wasm32-unknown-unknown`) using `cargo`.
  2. Generates high-performance JS bindings with `wasm-bindgen`.
  3. Optimizes the binary size with `wasm-opt`.
  4. Builds three variants: `client` (browser runtime), `server` (SSR), and `encode` (build tool).
- **`pnpm test`**: Runs `vitest`.

### Configuration

- **`rsbuild.config.ts`**: Configures the bundling of the client-side JavaScript, ensuring correct entry points (`ts/client/index.ts`) and output paths.
- **`vitest.config.ts`**: Configures the test runner, including mappings to load the Wasm binary during tests.

### Testing Strategy

- **`tests/element-apis.spec.ts`**: A key test file. It validates the `MainThreadWasmContext` logic by mocking the Wasm binding entirely in JavaScript (`WASMJSBinding.ts`). This allows testing DOM manipulation logic without loading the actual Wasm binary in every test.
- **`tests/encode.spec.ts`**: Verifies that the CSS encoder correctly serializes various CSS rules.
- **`tests/lazy-load.spec.ts`**: Ensures that custom elements are loaded dynamically only when needed.
- **Rust Tests**: run `cargo test --all-features` and `cargo test --target wasm32-unknown-unknown --all-features` separately.

## Guidelines for LLMs

1. **Context Matters**: Determine if you are working on **Core Logic** (Rust), **Binding Logic** (TypeScript), or **Application Logic** (BTS).
2. **Performance is Key**: This package is the engine. Avoid main-thread blocking concepts. Prefer Wasm for heavy compute.
3. **Testing**: When modifying `src/main_thread`, ALWAYS add corresponding tests in `tests/element-apis.spec.ts` to verify the JS-side behavior.
4. **Documentation**: Keep this file updated if you add new modules or change the architecture.

## Technical Learnings

### WASM <-> JS Interop

- **Recursive Borrowing**: Avoid patterns where Rust calls JS, and JS immediately calls back into Rust to retrieve data that Rust already possesses. This will cause `RefCell` borrowing panics ("recursive use of an object").
- **Object Passing**: Instead of passing IDs (like `uniqueId`) from Rust to JS and having JS callback to retrieve the object, pass the object reference (e.g., `&web_sys::HtmlElement`) directly from Rust to JS. `wasm-bindgen` handles this seamlessly and key for avoiding re-entrant calls.

## Benchmarking

### Rust (wasm32)

- Run: cargo bench --target wasm32-unknown-unknown --all-features
- Bench entry: packages/web-platform/web-core-wasm/benches/wasm_bench.rs
- Bench helper module: packages/web-platform/web-core-wasm/benches/support/bench_support.rs

Notes:

- Keep helper modules under benches/support/ so Cargo does not treat them as standalone benchmark targets.
- The helper is included into the crate via a #[path = "../benches/support/bench_support.rs"] module in src/lib.rs, gated behind cfg(all(feature = "client", feature = "encode", target_arch = "wasm32")).
