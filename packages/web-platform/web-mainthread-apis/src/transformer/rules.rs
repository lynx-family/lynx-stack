use crate::transformer::constants::*;
use std::collections::HashMap;

lazy_static::lazy_static! {
  pub static ref RENAME_RULE: HashMap<&'static [u16], &'static [u16]> = {
    let mut map = HashMap::new();
    map.insert(LINEAR_WEIGHT_STR_U16, LINEAR_WEIGHT_CSS_VAR_NAME);
    map.insert(FLEX_DIRECTION_STR_U16, FLEX_DIRECTION_CSS_VAR_NAME);
    map.insert(FLEX_WRAP_STR_U16, FLEX_WRAP_CSS_VAR_NAME);
    map.insert(FLEX_GROW_STR_U16, FLEX_GROW_CSS_VAR_NAME);
    map.insert(FLEX_SHRINK_STR_U16, FLEX_SHRINK_CSS_VAR_NAME);
    map.insert(FLEX_BASIS_STR_U16, FLEX_BASIS_CSS_VAR_NAME);
    map.insert(LIST_MAIN_AXIS_GAP_STR_U16, LIST_MAIN_AXIS_GAP_CSS_VAR_NAME);
    map.insert(LIST_CROSS_AXIS_GAP_STR_U16, LIST_CROSS_AXIS_GAP_CSS_VAR_NAME);
    map
  };

  pub static ref REPLACE_RULE: HashMap<&'static [u16], HashMap<&'static [u16], &'static [[&'static [u16]; 2]]>> = {
    let mut map = HashMap::new();

    // Display rules
    let mut display_map = HashMap::new();
    display_map.insert(LINEAR_STR_U16, &[
      [LYNX_DISPLAY_TOGGLE_STR_U16, LYNX_DISPLAY_LINEAR_VAR_STR_U16],
      [LYNX_DISPLAY_STR_U16, LINEAR_STR_U16],
      [DISPLAY_STR_U16, FLEX_STR_U16],
    ] as &[[&[u16]; 2]]);
    display_map.insert(FLEX_STR_U16, &[
      [LYNX_DISPLAY_TOGGLE_STR_U16, LYNX_DISPLAY_FLEX_VAR_STR_U16],
      [LYNX_DISPLAY_STR_U16, FLEX_STR_U16],
      [DISPLAY_STR_U16, FLEX_STR_U16],
    ] as &[[&[u16]; 2]]);

    // Direction rules
    let mut direction_map = HashMap::new();
    direction_map.insert(LYNX_RTL_STR_U16, &[
      [DIRECTION_STR_U16, RTL_STR_U16],
    ] as &[[&[u16]; 2]]);

    // Linear orientation rules
    let mut linear_orientation_map = HashMap::new();
    linear_orientation_map.insert(HORIZONTAL_STR_U16, &[
      [LYNX_LINEAR_ORIENTATION_STR_U16, HORIZONTAL_STR_U16],
      [LYNX_LINEAR_ORIENTATION_TOGGLE_STR_U16, LYNX_LINEAR_ORIENTATION_TOGGLE_HORIZONTAL_VALUE_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_orientation_map.insert(HORIZONTAL_REVERSE_STR_U16, &[
      [LYNX_LINEAR_ORIENTATION_STR_U16, HORIZONTAL_REVERSE_STR_U16],
      [LYNX_LINEAR_ORIENTATION_TOGGLE_STR_U16, LYNX_LINEAR_ORIENTATION_TOGGLE_HORIZONTAL_REVERSE_VALUE_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_orientation_map.insert(VERTICAL_STR_U16, &[
      [LYNX_LINEAR_ORIENTATION_STR_U16, VERTICAL_STR_U16],
      [LYNX_LINEAR_ORIENTATION_TOGGLE_STR_U16, LYNX_LINEAR_ORIENTATION_TOGGLE_VERTICAL_VALUE_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_orientation_map.insert(VERTICAL_REVERSE_STR_U16, &[
      [LYNX_LINEAR_ORIENTATION_STR_U16, VERTICAL_REVERSE_STR_U16],
      [LYNX_LINEAR_ORIENTATION_TOGGLE_STR_U16, LYNX_LINEAR_ORIENTATION_TOGGLE_VERTICAL_REVERSE_VALUE_STR_U16],
    ] as &[[&[u16]; 2]]);

    // Linear direction rules
    let mut linear_direction_map = HashMap::new();
    linear_direction_map.insert(ROW_STR_U16, &[
      [LYNX_LINEAR_ORIENTATION_STR_U16, HORIZONTAL_STR_U16],
      [LYNX_LINEAR_ORIENTATION_TOGGLE_STR_U16, LYNX_LINEAR_ORIENTATION_TOGGLE_HORIZONTAL_VALUE_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_direction_map.insert(ROW_REVERSE_STR_U16, &[
      [LYNX_LINEAR_ORIENTATION_STR_U16, HORIZONTAL_REVERSE_STR_U16],
      [LYNX_LINEAR_ORIENTATION_TOGGLE_STR_U16, LYNX_LINEAR_ORIENTATION_TOGGLE_HORIZONTAL_REVERSE_VALUE_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_direction_map.insert(COLUMN_STR_U16, &[
      [LYNX_LINEAR_ORIENTATION_STR_U16, VERTICAL_STR_U16],
      [LYNX_LINEAR_ORIENTATION_TOGGLE_STR_U16, LYNX_LINEAR_ORIENTATION_TOGGLE_VERTICAL_VALUE_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_direction_map.insert(COLUMN_REVERSE_STR_U16, &[
      [LYNX_LINEAR_ORIENTATION_STR_U16, VERTICAL_REVERSE_STR_U16],
      [LYNX_LINEAR_ORIENTATION_TOGGLE_STR_U16, LYNX_LINEAR_ORIENTATION_TOGGLE_VERTICAL_REVERSE_VALUE_STR_U16],
    ] as &[[&[u16]; 2]]);

    // Linear gravity rules
    let mut linear_gravity_map = HashMap::new();
    linear_gravity_map.insert(TOP_STR_U16, &[
      [JUSTIFY_CONTENT_COLUMN_STR_U16, FLEX_START_STR_U16],
      [JUSTIFY_CONTENT_COLUMN_REVERSE_STR_U16, FLEX_END_STR_U16],
      [JUSTIFY_CONTENT_ROW_STR_U16, FLEX_START_STR_U16],
      [JUSTIFY_CONTENT_ROW_REVERSE_STR_U16, FLEX_START_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_gravity_map.insert(BOTTOM_STR_U16, &[
      [JUSTIFY_CONTENT_COLUMN_STR_U16, FLEX_END_STR_U16],
      [JUSTIFY_CONTENT_COLUMN_REVERSE_STR_U16, FLEX_START_STR_U16],
      [JUSTIFY_CONTENT_ROW_STR_U16, FLEX_START_STR_U16],
      [JUSTIFY_CONTENT_ROW_REVERSE_STR_U16, FLEX_START_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_gravity_map.insert(LEFT_STR_U16, &[
      [JUSTIFY_CONTENT_COLUMN_STR_U16, FLEX_START_STR_U16],
      [JUSTIFY_CONTENT_COLUMN_REVERSE_STR_U16, FLEX_START_STR_U16],
      [JUSTIFY_CONTENT_ROW_STR_U16, FLEX_START_STR_U16],
      [JUSTIFY_CONTENT_ROW_REVERSE_STR_U16, FLEX_END_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_gravity_map.insert(RIGHT_STR_U16, &[
      [JUSTIFY_CONTENT_COLUMN_STR_U16, FLEX_START_STR_U16],
      [JUSTIFY_CONTENT_COLUMN_REVERSE_STR_U16, FLEX_START_STR_U16],
      [JUSTIFY_CONTENT_ROW_STR_U16, FLEX_END_STR_U16],
      [JUSTIFY_CONTENT_ROW_REVERSE_STR_U16, FLEX_START_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_gravity_map.insert(CENTER_VERTICAL_STR_U16, &[
      [JUSTIFY_CONTENT_COLUMN_STR_U16, CENTER_STR_U16],
      [JUSTIFY_CONTENT_COLUMN_REVERSE_STR_U16, CENTER_STR_U16],
      [JUSTIFY_CONTENT_ROW_STR_U16, FLEX_START_STR_U16],
      [JUSTIFY_CONTENT_ROW_REVERSE_STR_U16, FLEX_START_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_gravity_map.insert(CENTER_HORIZONTAL_STR_U16, &[
      [JUSTIFY_CONTENT_COLUMN_STR_U16, FLEX_START_STR_U16],
      [JUSTIFY_CONTENT_COLUMN_REVERSE_STR_U16, FLEX_START_STR_U16],
      [JUSTIFY_CONTENT_ROW_STR_U16, CENTER_STR_U16],
      [JUSTIFY_CONTENT_ROW_REVERSE_STR_U16, CENTER_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_gravity_map.insert(START_STR_U16, &[
      [JUSTIFY_CONTENT_COLUMN_STR_U16, FLEX_START_STR_U16],
      [JUSTIFY_CONTENT_COLUMN_REVERSE_STR_U16, FLEX_START_STR_U16],
      [JUSTIFY_CONTENT_ROW_STR_U16, FLEX_START_STR_U16],
      [JUSTIFY_CONTENT_ROW_REVERSE_STR_U16, FLEX_START_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_gravity_map.insert(END_STR_U16, &[
      [JUSTIFY_CONTENT_COLUMN_STR_U16, FLEX_END_STR_U16],
      [JUSTIFY_CONTENT_COLUMN_REVERSE_STR_U16, FLEX_END_STR_U16],
      [JUSTIFY_CONTENT_ROW_STR_U16, FLEX_END_STR_U16],
      [JUSTIFY_CONTENT_ROW_REVERSE_STR_U16, FLEX_END_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_gravity_map.insert(CENTER_STR_U16, &[
      [JUSTIFY_CONTENT_COLUMN_STR_U16, CENTER_STR_U16],
      [JUSTIFY_CONTENT_COLUMN_REVERSE_STR_U16, CENTER_STR_U16],
      [JUSTIFY_CONTENT_ROW_STR_U16, CENTER_STR_U16],
      [JUSTIFY_CONTENT_ROW_REVERSE_STR_U16, CENTER_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_gravity_map.insert(SPACE_BETWEEN_STR_U16, &[
      [JUSTIFY_CONTENT_COLUMN_STR_U16, SPACE_BETWEEN_STR_U16],
      [JUSTIFY_CONTENT_COLUMN_REVERSE_STR_U16, SPACE_BETWEEN_STR_U16],
      [JUSTIFY_CONTENT_ROW_STR_U16, SPACE_BETWEEN_STR_U16],
      [JUSTIFY_CONTENT_ROW_REVERSE_STR_U16, SPACE_BETWEEN_STR_U16],
    ] as &[[&[u16]; 2]]);

    // Linear cross gravity rules
    let mut linear_cross_gravity_map = HashMap::new();
    linear_cross_gravity_map.insert(START_STR_U16, &[
      [ALIGN_ITEMS_STR_U16, START_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_cross_gravity_map.insert(END_STR_U16, &[
      [ALIGN_ITEMS_STR_U16, END_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_cross_gravity_map.insert(CENTER_STR_U16, &[
      [ALIGN_ITEMS_STR_U16, CENTER_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_cross_gravity_map.insert(STRETCH_STR_U16, &[
      [ALIGN_ITEMS_STR_U16, STRETCH_STR_U16],
    ] as &[[&[u16]; 2]]);

    // Linear layout gravity rules
    let mut linear_layout_gravity_map = HashMap::new();
    linear_layout_gravity_map.insert(NONE_STR_U16, &[
      [ALIGN_SELF_ROW_STR_U16, AUTO_STR_U16],
      [ALIGN_SELF_COLUMN_STR_U16, AUTO_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_layout_gravity_map.insert(STRETCH_STR_U16, &[
      [ALIGN_SELF_ROW_STR_U16, STRETCH_STR_U16],
      [ALIGN_SELF_COLUMN_STR_U16, STRETCH_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_layout_gravity_map.insert(TOP_STR_U16, &[
      [ALIGN_SELF_ROW_STR_U16, START_STR_U16],
      [ALIGN_SELF_COLUMN_STR_U16, AUTO_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_layout_gravity_map.insert(BOTTOM_STR_U16, &[
      [ALIGN_SELF_ROW_STR_U16, END_STR_U16],
      [ALIGN_SELF_COLUMN_STR_U16, AUTO_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_layout_gravity_map.insert(LEFT_STR_U16, &[
      [ALIGN_SELF_ROW_STR_U16, AUTO_STR_U16],
      [ALIGN_SELF_COLUMN_STR_U16, START_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_layout_gravity_map.insert(RIGHT_STR_U16, &[
      [ALIGN_SELF_ROW_STR_U16, AUTO_STR_U16],
      [ALIGN_SELF_COLUMN_STR_U16, END_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_layout_gravity_map.insert(START_STR_U16, &[
      [ALIGN_SELF_ROW_STR_U16, START_STR_U16],
      [ALIGN_SELF_COLUMN_STR_U16, START_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_layout_gravity_map.insert(END_STR_U16, &[
      [ALIGN_SELF_ROW_STR_U16, END_STR_U16],
      [ALIGN_SELF_COLUMN_STR_U16, END_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_layout_gravity_map.insert(CENTER_STR_U16, &[
      [ALIGN_SELF_ROW_STR_U16, CENTER_STR_U16],
      [ALIGN_SELF_COLUMN_STR_U16, CENTER_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_layout_gravity_map.insert(CENTER_VERTICAL_STR_U16, &[
      [ALIGN_SELF_ROW_STR_U16, CENTER_STR_U16],
      [ALIGN_SELF_COLUMN_STR_U16, START_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_layout_gravity_map.insert(CENTER_HORIZONTAL_STR_U16, &[
      [ALIGN_SELF_ROW_STR_U16, START_STR_U16],
      [ALIGN_SELF_COLUMN_STR_U16, CENTER_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_layout_gravity_map.insert(FILL_VERTICAL_STR_U16, &[
      [ALIGN_SELF_ROW_STR_U16, STRETCH_STR_U16],
      [ALIGN_SELF_COLUMN_STR_U16, AUTO_STR_U16],
    ] as &[[&[u16]; 2]]);
    linear_layout_gravity_map.insert(FILL_HORIZONTAL_STR_U16, &[
      [ALIGN_SELF_ROW_STR_U16, AUTO_STR_U16],
      [ALIGN_SELF_COLUMN_STR_U16, STRETCH_STR_U16],
    ] as &[[&[u16]; 2]]);

    // Justify content rules
    let mut justify_content_map = HashMap::new();
    justify_content_map.insert(START_STR_U16, &[
      [JUSTIFY_CONTENT_STR_U16, FLEX_START_STR_U16],
      [JUSTIFY_CONTENT_STR_U16, START_STR_U16],
    ] as &[[&[u16]; 2]]);
    justify_content_map.insert(END_STR_U16, &[
      [JUSTIFY_CONTENT_STR_U16, FLEX_END_STR_U16],
      [JUSTIFY_CONTENT_STR_U16, END_STR_U16],
    ] as &[[&[u16]; 2]]);

    map.insert(DISPLAY_STR_U16, display_map);
    map.insert(DIRECTION_STR_U16, direction_map);
    map.insert(LINEAR_ORIENTATION_STR_U16, linear_orientation_map);
    map.insert(LINEAR_DIRECTION_STR_U16, linear_direction_map);
    map.insert(LINEAR_GRAVITY_STR_U16, linear_gravity_map);
    map.insert(LINEAR_CROSS_GRAVITY_STR_U16, linear_cross_gravity_map);
    map.insert(LINEAR_LAYOUT_GRAVITY_STR_U16, linear_layout_gravity_map);
    map.insert(JUSTIFY_CONTENT_STR_U16, justify_content_map);

    map
  };
}

#[macro_export]
macro_rules! get_rename_rule_value {
  ($name_slice:expr, $start:expr, $end:expr) => {
    crate::transformer::rules::RENAME_RULE
      .get(&$name_slice[$start..$end])
      .copied()
  };
}

#[macro_export]
macro_rules! get_replace_rule_value {
  ($name_slice:expr, $name_start:expr, $name_end:expr, $value_slice:expr, $value_start:expr, $value_end:expr) => {
    if let Some(sub_rule) =
      crate::transformer::rules::REPLACE_RULE.get(&$name_slice[$name_start..$name_end])
    {
      sub_rule
        .get(&$value_slice[$value_start..$value_end])
        .copied()
    } else {
      None
    }
  };
}

#[cfg(test)]
mod tests {
  use std::str::from_utf8;

  use crate::str_to_u16_slice;

  #[test]
  fn test_rename_rule_flex_direction() {
    let source = "flex-direction:row".as_bytes();
    let source: Vec<u16> = source.iter().map(|&b| b as u16).collect();
    let name_start = 0;
    let name_end = source.len() - 4;
    let result: &'static [u16] = get_rename_rule_value!(&source, name_start, name_end).unwrap();
    assert_eq!(result, str_to_u16_slice!("--flex-direction"));
  }
  #[test]
  fn test_rename_rule_flex_direction_at_mid() {
    let source = "height:1px;flex-direction:row".as_bytes();
    let offset = "height:1px;".len();
    let source: Vec<u16> = source.iter().map(|&b| b as u16).collect();
    let name_start = offset;
    let name_end = source.len() - 4;
    let result = get_rename_rule_value!(&source, name_start, name_end).unwrap();
    assert_eq!(result, str_to_u16_slice!("--flex-direction"));
  }
  #[test]
  fn test_replace_rule_display_linear() {
    let source = "display:linear".as_bytes();
    let source: Vec<u16> = source.iter().map(|&b| b as u16).collect();
    let name_start = 0;
    let name_end = 7;
    let value_start = 8;
    let value_end = source.len();
    let result = get_replace_rule_value!(
      &source,
      name_start,
      name_end,
      &source,
      value_start,
      value_end
    )
    .unwrap()
    .iter()
    .map(|pair| {
      let key = pair[0].iter().map(|&c| c as u8).collect::<Vec<u8>>();
      let value = pair[1].iter().map(|&c| c as u8).collect::<Vec<u8>>();
      format!(
        "{}:{}",
        from_utf8(&key).unwrap(),
        from_utf8(&value).unwrap()
      )
    })
    .collect::<Vec<_>>()
    .join(";");
    assert_eq!(
      result,
      "--lynx-display-toggle:var(--lynx-display-linear);--lynx-display:linear;display:flex"
    );
  }
  #[test]
  fn test_replace_rule_display_linear_at_mid() {
    let source = "height:1px;display:linear".as_bytes();
    let source: Vec<u16> = source.iter().map(|&b| b as u16).collect();
    let offset = "height:1px;".len();
    let name_start = offset;
    let name_end = offset + 7;
    let value_start = offset + 8;
    let value_end = source.len();
    let result = get_replace_rule_value!(
      &source,
      name_start,
      name_end,
      &source,
      value_start,
      value_end
    )
    .unwrap()
    .iter()
    .map(|pair| {
      let key = pair[0].iter().map(|&c| c as u8).collect::<Vec<u8>>();
      let value = pair[1].iter().map(|&c| c as u8).collect::<Vec<u8>>();
      format!(
        "{}:{}",
        from_utf8(&key).unwrap(),
        from_utf8(&value).unwrap()
      )
    })
    .collect::<Vec<_>>()
    .join(";");
    assert_eq!(
      result,
      "--lynx-display-toggle:var(--lynx-display-linear);--lynx-display:linear;display:flex"
    );
  }

  #[test]
  fn test_rename_rule_not_exist() {
    let source = "background-image:url(\"https://example.com\")".as_bytes();
    let source: Vec<u16> = source.iter().map(|&b| b as u16).collect();
    let name_start = 0;
    let name_end = "background-image".len();
    let result = get_rename_rule_value!(&source, name_start, name_end);
    assert_eq!(result, None);
  }

  #[test]
  fn test_replace_rule_value_not_match() {
    let source = "display:grid".as_bytes();
    let source: Vec<u16> = source.iter().map(|&b| b as u16).collect();
    let name_start = 0;
    let name_end = 7;
    let value_start = 8;
    let value_end = source.len();
    let result = get_replace_rule_value!(
      &source,
      name_start,
      name_end,
      &source,
      value_start,
      value_end
    );
    assert_eq!(result, None);
  }

  #[test]
  fn test_replace_rule_name_not_match() {
    let source = "height:1px".as_bytes();
    let source: Vec<u16> = source.iter().map(|&b| b as u16).collect();
    let name_start = 0;
    let name_end = 6;
    let value_start = 7;
    let value_end = source.len();
    let result = get_replace_rule_value!(
      &source,
      name_start,
      name_end,
      &source,
      value_start,
      value_end
    );
    assert_eq!(result, None);
  }
}
