use crate::transformer::constants::{
  COLOR_APPENDIX_FOR_GRADIENT, COLOR_APPENDIX_FOR_NORMAL_COLOR, COLOR_STR_U16, IMPORTANT_STR_U16,
  LINEAR_GRADIENT_STR_U16,
};
use crate::{
  css::{self, parse_inline_style::Transformer},
  get_rename_rule_value, get_replace_rule_value,
};

pub struct TransformerData<'a> {
  source: &'a [u16],
  transformed_source: Vec<u16>,
  offset: usize, // current the tail offset of the original source
}

// append ';' at the end of each declaration except the last one
macro_rules! append_separator {
  ($transformed_source:expr, $decl_index:expr, $total_len:expr, $is_important:expr) => {
    if $decl_index < $total_len - 1 {
      if $is_important {
        $transformed_source.extend_from_slice(IMPORTANT_STR_U16);
      }
      $transformed_source.push(b';' as u16);
    }
  };
}

impl<'a> Transformer for TransformerData<'a> {
  fn on_declaration(
    &mut self,
    name_start: usize,
    name_end: usize,
    value_start: usize,
    value_end: usize,
    is_important: bool,
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
        .extend(renamed_value[0].bytes().map(|b| b as u16));
      self.offset = name_end;
    } else if let Some(replaced_value) = get_replace_rule_value!(
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
      for ii in 0..replaced_value.len() {
        let one_decl = &replaced_value[ii];
        // Convert the bytes to u16 values
        self
          .transformed_source
          .extend(one_decl.bytes().map(|b| b as u16));
        append_separator!(
          self.transformed_source,
          ii,
          replaced_value.len(),
          is_important
        );
      }
      self.offset = value_end;
    }
    // now transform color
    /*
      if there is a color:linear-gradient(xx) declaration,
        we will transform it to:
        color: transparent;
        --lynx-text-bg-color: linear-gradient(xx);
        -webkit-background-clip: text;
        background-clip: text;
      otherwise:
        --lynx-text-bg-color: initial;
        -webkit-background-clip: initial;
        background-clip: initial;
        color: xx;
    */
    // compare the name is "color"
    else if name_end - name_start == COLOR_STR_U16.len()
      && self.source[name_start..name_end] == *COLOR_STR_U16
    {
      // check if the value is starting with "linear-gradient"
      let is_linear_gradient = value_end - value_start >= LINEAR_GRADIENT_STR_U16.len()
        && self.source[value_start..value_start + LINEAR_GRADIENT_STR_U16.len()]
          == *LINEAR_GRADIENT_STR_U16;
      let appendix = if is_linear_gradient {
        COLOR_APPENDIX_FOR_GRADIENT
      } else {
        COLOR_APPENDIX_FOR_NORMAL_COLOR
      };
      for ii in 0..appendix.len() {
        let one_decl = appendix[ii];
        // Convert the bytes to u16 values
        self
          .transformed_source
          .extend(one_decl.bytes().map(|b| b as u16));
        append_separator!(
          self.transformed_source,
          ii,
          appendix.len() + 1, // +1 because the last one we only replace the name
          is_important
        );
      }
      if is_linear_gradient {
        self
          .transformed_source
          .extend("--lynx-text-bg-color".bytes().map(|b| b as u16));
        self.offset = name_end;
      } else {
        self.offset = name_start;
      };
      // this is special because we expect to remain the value for color: xx or --lynx-text-bg-color: linear-gradient(xx)
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
      "height:1px;--lynx-display-toggle:var(--lynx-display-linear);--lynx-display:linear;display:flex;--flex-direction:row;width:100px;"
    );
  }

  #[test]
  fn transform_with_blank() {
    let source = "flex-direction : row ;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source);
    assert_eq!(
      String::from_utf16_lossy(&result),
      "--flex-direction : row ;"
    );
  }

  #[test]
  fn test_replace_rule_display_linear_blank_after_colon() {
    let source = "display: linear;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source);
    assert_eq!(
      String::from_utf16_lossy(&result),
      "--lynx-display-toggle:var(--lynx-display-linear);--lynx-display:linear;display:flex;"
    );
  }

  #[test]
  fn test_replace_rule_display_linear_important() {
    let source = "display: linear !important;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source);
    assert_eq!(
      String::from_utf16_lossy(&result),
      "--lynx-display-toggle:var(--lynx-display-linear) !important;--lynx-display:linear !important;display:flex !important;"
    );
  }

  #[test]
  fn transform_color_normal() {
    let source = " color : blue ;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source);
    assert_eq!(
      String::from_utf16_lossy(&result),
      "--lynx-text-bg-color:initial;-webkit-background-clip:initial;background-clip:initial;color : blue ;"
    );
  }

  #[test]
  fn transform_color_normal_important() {
    let source = " color : blue !important ;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source);
    assert_eq!(
      String::from_utf16_lossy(&result),
      "--lynx-text-bg-color:initial !important;-webkit-background-clip:initial !important;background-clip:initial !important;color : blue !important ;"
    );
  }

  #[test]
  fn transform_color_linear_gradient() {
    let source = " color : linear-gradient(pink, blue) ;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source);
    assert_eq!(
      String::from_utf16_lossy(&result),
      "color:transparent;-webkit-background-clip:text;background-clip:text;--lynx-text-bg-color : linear-gradient(pink, blue) ;"
    );
  }

  #[test]
  fn transform_color_linear_gradient_important() {
    let source = " color : linear-gradient(pink, blue) !important ;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source);
    assert_eq!(
      String::from_utf16_lossy(&result),
      "color:transparent !important;-webkit-background-clip:text !important;background-clip:text !important;--lynx-text-bg-color : linear-gradient(pink, blue) !important ;"
    );
  }
}
