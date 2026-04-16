/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

/// Template module.
///
/// This module defines the structure of Lynx templates, including element templates and style information.
/// It handles the serialization and deserialization of templates using `rkyv`.
///
/// Key components:
/// - `template_sections`: Contains submodules for different sections of a template.
///   - `element_template`: Defines `RawElementTemplate` which contains operations to build the element tree.
///   - `style_info`: Defines `RawStyleInfo` which contains style sheets and rules.
pub(crate) mod template_sections;
