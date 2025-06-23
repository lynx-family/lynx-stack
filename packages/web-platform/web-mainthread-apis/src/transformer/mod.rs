use crate::{
  css::{self, parse_inline_style::Transformer},
  get_rename_rule_value, get_replace_rule_value,
};

pub mod trie;

pub struct TransformerData<'a> {
  source: &'a [u16],
  transformed_source: Vec<u16>,
  offset: usize, // current the tail offset of the original source
}

impl<'a> Transformer for TransformerData<'a> {
  fn on_declaration(
    &mut self,
    name_start: usize,
    name_end: usize,
    value_start: usize,
    value_end: usize,
    _: bool,
  ) {
    // check the rename rule
    if let Some(renamed_value) = get_rename_rule_value!(self.source, name_start, name_end) {
      // if we have a rename rule, we will use it
      self
        .transformed_source
        .extend_from_slice(&self.source[self.offset..name_start]);
      // Convert the bytes to u16 values
      self
        .transformed_source
        .extend(renamed_value.bytes().map(|b| b as u16));
      self.offset = name_end;
    }
    if let Some(replaced_value) = get_replace_rule_value!(
      self.source,
      name_start,
      name_end,
      self.source,
      value_start,
      value_end
    ) {
      self
        .transformed_source
        .extend_from_slice(&self.source[self.offset..name_start]);
      // Convert the bytes to u16 values
      self
        .transformed_source
        .extend(replaced_value.bytes().map(|b| b as u16));
      self.offset = value_end;
    }
  }
}

pub fn transform_inline_style_string<'a>(source: &'a [u16]) -> Vec<u16> {
  let mut transformer: TransformerData<'a> = TransformerData {
    source,
    transformed_source: Vec::new(),
    offset: 0,
  };
  css::parse_inline_style::parse_inline_style(source, &mut transformer);
  if transformer.offset != 0 {
    // append the remaining part of the source
    transformer
      .transformed_source
      .extend_from_slice(&source[transformer.offset..]);
  }
  transformer.transformed_source
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn transform_basic() {
    let source = "height:1px;display:linear;flex-direction:row;width:100px;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source);
    assert_eq!(
      String::from_utf16_lossy(&result),
      "height:1px;--lynx-display-toggle:var(--lynx-display-linear); --lynx-display:linear; display:flex;--flex-direction:row;width:100px;"
    );
  }
}
