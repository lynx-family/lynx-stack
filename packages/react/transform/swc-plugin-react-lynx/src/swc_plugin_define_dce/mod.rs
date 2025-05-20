use std::{collections::HashMap, fmt::Debug};
use serde::Deserialize;

<<<<<<< HEAD:packages/react/transform/src/swc_plugin_define_dce/mod.rs
use napi_derive::napi;

/// {@inheritdoc PluginReactLynxOptions.defineDCE}
/// @public
#[napi(object)]
#[derive(Clone, Debug)]
=======
#[derive(Deserialize, Clone, Debug, PartialEq)]
>>>>>>> 3ce4ca6a (refactor: adopt swc-plugin-compat and swc-plugin-react-lynx):packages/react/transform/swc-plugin-react-lynx/src/swc_plugin_define_dce/mod.rs
pub struct DefineDCEVisitorConfig {
  /// @public
  /// Replaces variables in your code with other values or expressions at compile time.
  ///
  /// @remarks
  /// Caveat: differences between `source.define`
  ///
  /// `defineDCE` happens before transforming `background-only` directives.
  /// So it's useful for eliminating code that is only used in the background from main-thread.
  ///
  /// @example
  ///
  /// ```js
  /// import { defineConfig } from '@lynx-js/rspeedy'
  /// import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
  ///
  /// export default defineConfig({
  ///   plugins: [
  ///     pluginReactLynx({
  ///       defineDCE: {
  ///         define: {
  ///           __FOO__: 'false',
  ///           'process.env.PLATFORM': '"lynx"',
  ///         },
  ///       },
  ///     })
  ///   ],
  /// })
  /// ```
  ///
  /// Then, `__FOO__` and `process.env.PLATFORM` could be used in source code.
  ///
  /// ```
  /// if (process.env.PLATFORM === 'lynx') {
  ///   console.log('lynx')
  /// }
  ///
  /// function FooOrBar() {
  ///   if (__FOO__) {
  ///     return <text>foo</text>
  ///   } else {
  ///     return <text>bar</text>
  ///   }
  /// }
  /// ```
  pub define: HashMap<String, String>,
}

impl Default for DefineDCEVisitorConfig {
  fn default() -> Self {
    DefineDCEVisitorConfig {
      define: HashMap::from([
        ("__LEPUS__".into(), "true".into()),
        ("__JS__".into(), "false".into()),
      ]),
    }
  }
}
