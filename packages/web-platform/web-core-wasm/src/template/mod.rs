// mod encode;
mod decoded;
mod raw_template;
// mod template_manager;
pub(crate) use decoded::{DecodedTemplateImpl, FlattenedStyleInfo};
pub(crate) use raw_template::{ElementTemplate, PageConfig, Selector};
// pub(crate) use template_manager::TemplateManager;
const CURRENT_VERSION: u32 = '{' as u32 + 1; // '{' for json detection
const VERSION_SIZE: usize = CURRENT_VERSION.to_le_bytes().len();
#[cfg(test)]
pub(crate) use decoded::FlattenedStyleSheet;
#[cfg(test)]
pub(crate) use raw_template::StyleRule;
