# Web Core WASM

This package (`web-core-wasm`) is a critical component of the Lynx Web Platform, implemented in Rust and compiled to WebAssembly (WASM). It handles performance-sensitive tasks such as CSS tokenization, style transformation, template processing, and main-thread element management.

## Overview

The primary goal of this package is to offload heavy computations from the JavaScript main thread to WASM, thereby improving the overall performance and responsiveness of Lynx applications on the web. Key responsibilities include:

- **CSS Processing**: Tokenizing and transforming CSS according to Lynx-specific rules
- **Template Serialization**: Encoding/decoding element templates and style information using `bincode`
- **DOM Management**: Managing element state and event handling via the main thread context (client feature)
- **Style Transformation**: Converting Lynx-specific CSS properties (e.g., `display: linear`, `rpx` units) to web-compatible CSS

## Feature Flags

The crate uses Cargo feature flags to conditionally compile code:

| Feature  | Description                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `client` | Enables main-thread functionality (`main_thread`, `js_binding` modules, inline style transformation). Requires `web-sys`. |
| `encode` | Enables encoding/serialization of templates via `wasm_bindgen` exports. Used at build time.                               |
| `server` | Reserved for server-side rendering scenarios.                                                                             |

## Dependencies

Key external dependencies used in this crate:

| Dependency       | Purpose                                                           |
| ---------------- | ----------------------------------------------------------------- |
| `wasm-bindgen`   | Rust/JS interop for WASM                                          |
| `js-sys`         | JavaScript API bindings                                           |
| `web-sys`        | Web API bindings (client feature)                                 |
| `bincode` (v2.0) | Binary serialization for templates                                |
| `fnv`            | Fast hash maps and sets (`FnvHashMap`, `FnvHashSet`)              |
| `lazy_static`    | Lazy-initialized static data (transformation rules, tag mappings) |

## Architecture

The codebase is organized into several modules, each responsible for a specific domain:

- **`css_tokenizer`**: A CSS tokenizer based on CSS Syntax Level 3, ported from `css-tree`. Tokenizes CSS strings into tokens (ident, function, number, dimension, etc.) for downstream processing.
- **`style_transformer`**: Parses and transforms CSS declarations. Applies Lynx-to-web transformation rules (e.g., `display: linear` → flexbox, `rpx` → `calc()`). Uses `css_tokenizer` internally.
- **`template`**: Defines template structures (`RawElementTemplate`, `RawStyleInfo`, `StyleSheet`, `Rule`) and handles serialization/deserialization using `bincode`.
- **`leo_asm`**: Defines the "Leo Assembly" instruction set (`LEOAsmOpcode`). These opcodes represent DOM operations (create element, set attribute, append child, etc.).
- **`js_binding`** (Feature: `client`): Defines the Rust-to-JavaScript interface via `wasm-bindgen`. Exports `RustMainthreadContextBinding` for invoking JS methods (publishing events, running worklets, loading elements).
- **`main_thread`** (Feature: `client`): Core runtime logic for the main thread. Manages `MainThreadWasmContext` (element state, templates, events, DOM references).
- **`constants`**: Shared constants including attribute names, tag mappings (`LYNX_TAG_TO_HTML_TAG_MAP`), and the full CSS property map.

## Data Flow

### Build-time (encode feature)

```
Template Definition (JS) 
    → RawElementTemplate (Rust) 
    → bincode::encode 
    → Uint8Array (serialized)
    
Style Definition (JS) 
    → RawStyleInfo (Rust) 
    → StyleInfoDecoder 
    → DecodedStyleData 
    → bincode::encode 
    → Uint8Array
```

### Runtime (client feature)

```
Serialized Template (Uint8Array) 
    → bincode::decode 
    → ElementTemplateSection 
    → DecodedElementTemplate 
    → Execute Leo ASM operations 
    → DOM elements

Inline Style (String) 
    → transform_inline_style_string() 
    → Transformed CSS string 
    → Apply to element.style
```

## Guidelines for LLMs

When generating or modifying code in this package, please adhere to the following guidelines:

### 1. Code Quality and Consistency

- **Comments**: Ensure that all public structs, enums, and functions have clear documentation comments (`///`). Comments must accurately reflect the logic.
- **Logic**: Verify that the implementation matches the comments and the intended behavior.
- **Quality**: Prioritize code quality. "Better to have nothing than garbage".
- **Idiomatic Rust**: Use idiomatic Rust patterns. Prefer `Option::map`, `Result::and_then`, iterators, and pattern matching over imperative code where appropriate.
- **Error Handling**: Use `Result` types for fallible operations. Avoid `unwrap()` in production code paths; prefer `?` operator or explicit error handling.

### 2. Testing

- **Unit Tests**: Run `cargo test --all-features` to execute unit tests. Tests are co-located with the source code using `#[cfg(test)]`.
- **Coverage**: All new features and bug fixes must be accompanied by unit tests.
- **Verification**: Ensure that tests cover edge cases and verify the correctness of the logic.
- **Test Naming**: Use descriptive test names that explain what is being tested (e.g., `test_transform_rpx_case_insensitive`).

### 3. Performance

- **Main Thread**: Be mindful of the main thread execution time. Heavy tasks should be optimized or offloaded where possible.
- **Bundle Size**: Consider the impact on the WASM binary size. Keep the LCP (Largest Contentful Paint) in mind.
- **Legacy Support**: Ensure that the code performs well on browsers up to 2 years old. Provide performance downgrades for legacy environments if necessary, but ensure functionality remains intact.
- **Modern Browsers**: Aim for extreme performance and experience on modern browsers.
- **Memory Allocation**: Minimize allocations in hot paths. Use `String::with_capacity()` when the size is known, reuse buffers where possible.
- **WASM/JS Boundary**: Minimize crossing the WASM/JS boundary. Batch operations where possible.

### 4. Best Practices

- **Rust Idioms**: Use idiomatic Rust code.
- **WASM**: Be aware of WASM limitations and interop costs with JavaScript. Minimize crossing the WASM/JS boundary.

### 5. Feature Flags

- **Conditional Compilation**: Use `#[cfg(feature = "...")]` to conditionally compile code based on features.
- **Feature Dependencies**: When adding new functionality, carefully consider which feature flag it belongs to (`client`, `encode`, or `server`).
- **Testing Features**: When running tests, use `cargo test --all-features` to ensure all feature combinations are tested.

### 6. Others

- **Documentation**: Check if `AGENTS.md` needs to be updated to reflect your changes (e.g., new feature flags, structural changes, new dependencies).
- **In file documentation**: Check if the comments in the code need to be updated to reflect your changes.

## Development & Build

- **Build WASM**: `cargo build --target wasm32-unknown-unknown`
- **Test**: `cargo test --all-features`

## Module Details

### `css_tokenizer`

Implements CSS tokenization compliant with CSS Syntax Level 3. This module is a Rust port of the `css-tree` tokenizer.

- **Key files**: `tokenize.rs`, `token_types.rs`, `char_code_definitions.rs`, `utils.rs`.
- **Usage**: Used by `style_transformer` to parse CSS declarations.
- **Token Types**: Defines 26 token types including `IDENT_TOKEN`, `FUNCTION_TOKEN`, `NUMBER_TOKEN`, `DIMENSION_TOKEN`, `PERCENTAGE_TOKEN`, `STRING_TOKEN`, `URL_TOKEN`, `WHITESPACE_TOKEN`, and various punctuation tokens.
- **Character Classification**: Provides inline functions for efficient character classification (`is_digit`, `is_hex_digit`, `is_letter`, `is_name_start`, `is_name`, `is_white_space`, `is_newline`, etc.).
- **Parser Trait**: Defines a `Parser` trait with `on_token(token_type, token_value)` method that consumers implement to process tokens.

### `style_transformer`

Transforms CSS styles from Lynx-specific syntax to web-compatible CSS.

- **Key files**: `transformer.rs`, `rules.rs`, `token_transformer.rs`, `inline_style.rs` (client feature).
- **Usage**: Processes CSS declarations and applies transformation rules.
- **Transformation Pipeline**:
  1. CSS string → `tokenize()` → token stream
  2. Token stream → `transform_one_token()` → transformed tokens (e.g., `rpx` → `calc()`)
  3. Transformed tokens → `StyleTransformer` (state machine) → parsed declarations
  4. Parsed declarations → `query_transform_rules()` → final CSS output
- **Rule Types**:
  - **Rename Rules** (`RENAME_RULE`): Simple property renaming (e.g., `linear-weight` → `--lynx-linear-weight`, `flex-direction` → `--flex-direction`)
  - **Replace Rules** (`REPLACE_RULE`): Value-dependent transformations that expand to multiple properties
  - **Token Rules**: Per-token transformations (e.g., `rpx` unit conversion)
  - **Special Rules**: Hardcoded logic for `color` (gradient support) and `linear-weight-sum` (children styles)
- **Key Transformations**:
  - `display: linear` → `display: flex` with CSS custom property toggles (`--lynx-display-toggle`, `--lynx-display`)
  - `rpx` units → `calc(value * var(--rpx-unit))`
  - `linear-orientation`, `linear-direction` → `--lynx-linear-orientation` with toggle variables
  - `linear-gravity` → `--justify-content-*` variables for directional alignment
  - `linear-layout-gravity` → `--align-self-*` variables
  - `linear-cross-gravity` → `align-items`
  - `direction: lynx-rtl` → `direction: rtl`
  - `color: linear-gradient(...)` → transparent color + background-clip + custom property
  - `color: <other>` → adds background-clip reset for text gradient support
- **Architecture**:
  - `StyleTransformer`: Implements the `Parser` trait, parses CSS declarations using a state machine (status 0→1→2→3→0).
  - `Generator` trait: Consumers implement `push_transformed_style()` and `push_transform_kids_style()` to receive transformed declarations.
  - `transform_inline_style_string()`: Convenience function for transforming inline style strings (client feature).
  - `query_transform_rules()`: Returns a tuple of `(current_declarations, kids_declarations)` for a given property/value pair.

### `template`

Handles template structures for element trees and style information.

- **Key files**: `template_sections/element_template/raw_element_template.rs`, `template_sections/style_info/raw_style_info.rs`.
- **Usage**: Serialization and deserialization of templates using `bincode`.
- **Key Structures**:
  - `RawElementTemplate`: Contains a list of `Operation`s (Leo ASM instructions) and a set of tag names. Provides builder methods (encode feature) for constructing templates.
  - `ElementTemplateSection`: A map of template names to `RawElementTemplate` instances. Supports encoding/decoding via `bincode`.
  - `RawStyleInfo`: Maps CSS IDs to `StyleSheet` instances. Contains imports and rules.
  - `StyleSheet`: Contains imports (CSS ID references) and a list of `Rule` objects.
  - `Rule`: Contains rule type (Declaration, FontFace, KeyFrames), prelude (selectors), declaration block, and nested rules.
  - `Selector`: A list of `OneSimpleSelector` (class, id, attribute, type, pseudo-class, pseudo-element, universal, combinator).
  - `DecodedStyleData`: Decoded style content with style string, font-face content, and CSS-OG class selector mappings.

### `leo_asm`

Defines operations for the Leo engine's element tree manipulation.

- **Key files**: `operation.rs`.
- **Usage**: Used by templates to represent DOM manipulation instructions.
- **Opcodes**:
  - `SetAttribute (1)`: Set an attribute on an element.
  - `RemoveChild (3)`: Remove a child element.
  - `AppendChild (5)`: Append a child element to a parent.
  - `CreateElement (6)`: Create a new element with a tag name.
  - `SetAttributeSlot (7)`: Set an attribute slot for dynamic binding.
  - `AppendElementSlot (8)`: Append an element slot for dynamic children.
  - `SetDataset (10)`: Set a dataset property on an element.
  - `AddEvent (11)`: Add an event listener.
  - `AppendToRoot (12)`: Append an element to the root.
- **Operation Structure**: Each operation has an opcode, numeric operands (`Vec<i32>`), and string operands (`Vec<String>`).

### `js_binding` (Feature: `client`)

Defines the JS <-> Rust bridge, primarily used when the `client` feature is enabled.

- **Key files**: `mts_js_binding.rs`.
- **Exports**: `RustMainthreadContextBinding` (extern "C" type imported from JS).
- **Key Methods** (imported from JS):
  - `publish_mts_event` (js_name: `runWorklet`): Dispatches worklet events with target/current-target information.
  - `publish_event` (js_name: `publishEvent`): Dispatches cross-thread events to the JS side.
  - `add_event_listener` (js_name: `addEventListener`): Registers global event listeners.
  - `load_internal_web_element` (js_name: `loadInternalWebElement`): Loads internal web elements by ID.
  - `load_unknown_element` (js_name: `loadUnknownElement`): Loads unknown/custom elements by tag name.
  - `mark_exposure_related_element_by_unique_id` (js_name: `markExposureRelatedElementByUniqueId`): Marks elements for exposure/visibility tracking.

### `main_thread` (Feature: `client`)

Manages the main thread state.

- **Key files**: `main_thread_context.rs`, `element_apis/`.
- **Usage**: Central hub for element and template management at runtime.
- **`MainThreadWasmContext`**: The main state holder, containing:
  - `root_node`: The root DOM node.
  - `document`: The web document reference.
  - `unique_id_to_element_map`: Maps unique IDs to `LynxElementData` (element metadata).
  - `element_templates_instances`: Cached decoded element templates by URL and name.
  - `enabled_events`: Set of event names that have been globally enabled.
  - `page_element_unique_id`: The unique ID of the page element.
  - `mts_binding`: The JS binding for communication.
  - `config_enable_css_selector`: Whether CSS selector mode is enabled.
- **Element APIs** (submodules):
  - `component_apis`: Component-related operations.
  - `dataset_apis`: Dataset (data-* attributes) management.
  - `element_data`: `LynxElementData` struct holding per-element metadata (css_id, component_id, dataset, event handlers, exposure tracking).
  - `element_template_apis`: Template instantiation and DOM construction from templates.
  - `event_apis`: Event handler registration and dispatching (cross-thread and worklet events).
  - `style_apis`: Style manipulation using `transform_inline_style_string()`.
- **Key WASM Exports**:
  - `__CreateElementCommon`: Creates an element and registers it in the context.
  - `__wasm_add_event_bts`: Adds cross-thread event handlers.
  - `__wasm_add_event_run_worklet`: Adds worklet event handlers.
  - `__GetEvent`, `__GetEvents`: Retrieves event handler information.
  - `__wasm_take_timing_flags`: Retrieves and clears timing flags for performance tracking.

### `constants`

Defines shared constants and mappings used across modules.

- **Key files**: `constants.rs`.
- **Content**:
  - **Attribute Names**: `CSS_ID_ATTRIBUTE` (`l-css-id`), `LYNX_ENTRY_NAME_ATTRIBUTE` (`l-e-name`), `LYNX_UNIQUE_ID_ATTRIBUTE` (`l-uid`), `LYNX_TEMPLATE_MEMBER_ID_ATTRIBUTE` (`l-t-e-id`), `LYNX_EXPOSURE_ID_ATTRIBUTE` (`exposure-id`), `LYNX_TIMING_FLAG_ATTRIBUTE` (`__lynx_timing_flag`).
  - **Event Names**: `APPEAR_EVENT_NAME`, `DISAPPEAR_EVENT_NAME`.
  - **Tag Mappings**: `LYNX_TAG_TO_HTML_TAG_MAP` maps Lynx tags (`view`, `text`, `image`, `raw-text`, `scroll-view`, `wrapper`, `list`, `page`) to HTML custom element tags (`x-view`, `x-text`, etc.).
  - **Dynamic Loading**: `LYNX_TAG_TO_DYNAMIC_LOAD_TAG_ID` maps component tags to loader IDs for lazy loading.
  - **Pre-loaded Tags**: `ALREADY_LOADED_TAGS` lists tags that don't require dynamic loading.
  - **CSS Property Map**: `STYLE_PROPERTY_MAP` (client feature) - a comprehensive list of ~150 CSS properties for indexed access.
