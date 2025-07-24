#[macro_export]
macro_rules! str_to_u16_slice {
  ($s:expr) => {{
    const S: &str = $s;
    const LEN: usize = S.len();
    const fn make_array() -> [u16; LEN] {
      let bytes = S.as_bytes();
      let mut result = [0u16; LEN];
      let mut i = 0;
      while i < LEN {
        result[i] = bytes[i] as u16;
        i += 1;
      }
      result
    }
    const ARRAY: [u16; LEN] = make_array();
    &ARRAY
  }};
}

pub const IMPORTANT_STR_U16: &[u16] = str_to_u16_slice!(" !important");

pub const COLOR_STR_U16: &[u16] = str_to_u16_slice!("color");

pub const LINEAR_GRADIENT_STR_U16: &[u16] = str_to_u16_slice!("linear-gradient");

pub const COLOR_APPENDIX_FOR_GRADIENT: &[&[&[u16]; 2]] = &[
  &[str_to_u16_slice!("color"), str_to_u16_slice!("transparent")],
  &[
    str_to_u16_slice!("-webkit-background-clip"),
    str_to_u16_slice!("text"),
  ],
  &[
    str_to_u16_slice!("background-clip"),
    str_to_u16_slice!("text"),
  ],
];

pub const COLOR_APPENDIX_FOR_NORMAL_COLOR: &[&[&[u16]; 2]] = &[
  &[
    str_to_u16_slice!("--lynx-text-bg-color"),
    str_to_u16_slice!("initial"),
  ],
  &[
    str_to_u16_slice!("-webkit-background-clip"),
    str_to_u16_slice!("initial"),
  ],
  &[
    str_to_u16_slice!("background-clip"),
    str_to_u16_slice!("initial"),
  ],
];

pub const LIST_MAIN_AXIS_GAP_STR_U16: &[u16] = str_to_u16_slice!("list-main-axis-gap");

pub const LIST_MAIN_AXIS_GAP_CSS_VAR_NAME: &[u16] = str_to_u16_slice!("--list-main-axis-gap");

pub const LIST_CROSS_AXIS_GAP_STR_U16: &[u16] = str_to_u16_slice!("list-cross-axis-gap");

pub const LIST_CROSS_AXIS_GAP_CSS_VAR_NAME: &[u16] = str_to_u16_slice!("--list-cross-axis-gap");

pub const FLEX_DIRECTION_STR_U16: &[u16] = str_to_u16_slice!("flex-direction");

pub const FLEX_DIRECTION_CSS_VAR_NAME: &[u16] = str_to_u16_slice!("--flex-direction");

pub const FLEX_WRAP_STR_U16: &[u16] = str_to_u16_slice!("flex-wrap");

pub const FLEX_WRAP_CSS_VAR_NAME: &[u16] = str_to_u16_slice!("--flex-wrap");

pub const FLEX_GROW_STR_U16: &[u16] = str_to_u16_slice!("flex-grow");

pub const FLEX_GROW_CSS_VAR_NAME: &[u16] = str_to_u16_slice!("--flex-grow");

pub const FLEX_SHRINK_STR_U16: &[u16] = str_to_u16_slice!("flex-shrink");

pub const FLEX_SHRINK_CSS_VAR_NAME: &[u16] = str_to_u16_slice!("--flex-shrink");

pub const FLEX_BASIS_STR_U16: &[u16] = str_to_u16_slice!("flex-basis");

pub const FLEX_BASIS_CSS_VAR_NAME: &[u16] = str_to_u16_slice!("--flex-basis");

pub const FLEX_STR_U16: &[u16] = str_to_u16_slice!("flex");

pub const AUTO_STR_U16: &[u16] = str_to_u16_slice!("auto");

pub const NONE_STR_U16: &[u16] = str_to_u16_slice!("none");

pub const LINEAR_WEIGHT_STR_U16: &[u16] = str_to_u16_slice!("linear-weight");

pub const LINEAR_WEIGHT_CSS_VAR_NAME: &[u16] = str_to_u16_slice!("--lynx-linear-weight");

pub const LINEAR_WEIGHT_SUM_STR_U16: &[u16] = str_to_u16_slice!("linear-weight-sum");

pub const LINEAR_WEIGHT_SUM_CSS_VAR_NAME: &[u16] = str_to_u16_slice!("--lynx-linear-weight-sum");

pub const LINEAR_WEIGHT_BASIS_CSS_VAR_NAME: &[u16] =
  str_to_u16_slice!("--lynx-linear-weight-basis");

pub const LYNX_TEXT_BG_COLOR_STR_U16: &[u16] = str_to_u16_slice!("--lynx-text-bg-color");

pub const FLEX_NONE_TRANSFORMED_VALUES: &[&[&[u16]; 2]] = &[
  &[FLEX_SHRINK_CSS_VAR_NAME, str_to_u16_slice!("0")],
  &[FLEX_GROW_CSS_VAR_NAME, str_to_u16_slice!("0")],
  &[FLEX_BASIS_CSS_VAR_NAME, str_to_u16_slice!("auto")],
];

pub const FLEX_AUTO_TRANSFORMED_VALUES: &[&[&[u16]; 2]] = &[
  /*
   * --flex-shrink:1;
   * --flex-grow:1;
   * --flex-basis:auto;
   */
  &[FLEX_SHRINK_CSS_VAR_NAME, str_to_u16_slice!("1")],
  &[FLEX_GROW_CSS_VAR_NAME, str_to_u16_slice!("1")],
  &[FLEX_BASIS_CSS_VAR_NAME, str_to_u16_slice!("auto")],
];

pub const FLEX_SINGLE_VALUE_USE_GROW_TRANSFORMED_DEFAULT_VALUES: &[&[&[u16]; 2]] = &[
  /*
   * flex: <flex-grow> 1 0
   */
  &[FLEX_SHRINK_CSS_VAR_NAME, str_to_u16_slice!("1")],
  &[FLEX_BASIS_CSS_VAR_NAME, str_to_u16_slice!("0%")],
];

pub const FLEX_SINGLE_VALUE_USE_BASIS_TRANSFORMED_DEFAULT_VALUES: &[&[&[u16]; 2]] = &[
  /*
   * flex: 1 1 <flex-basis>
   */
  &[FLEX_SHRINK_CSS_VAR_NAME, str_to_u16_slice!("1")],
  &[FLEX_GROW_CSS_VAR_NAME, str_to_u16_slice!("1")],
];

pub const DISPLAY_STR_U16: &[u16] = str_to_u16_slice!("display");
pub const DIRECTION_STR_U16: &[u16] = str_to_u16_slice!("direction");
pub const LINEAR_ORIENTATION_STR_U16: &[u16] = str_to_u16_slice!("linear-orientation");
pub const LINEAR_DIRECTION_STR_U16: &[u16] = str_to_u16_slice!("linear-direction");
pub const LINEAR_GRAVITY_STR_U16: &[u16] = str_to_u16_slice!("linear-gravity");
pub const LINEAR_CROSS_GRAVITY_STR_U16: &[u16] = str_to_u16_slice!("linear-cross-gravity");
pub const LINEAR_LAYOUT_GRAVITY_STR_U16: &[u16] = str_to_u16_slice!("linear-layout-gravity");
pub const JUSTIFY_CONTENT_STR_U16: &[u16] = str_to_u16_slice!("justify-content");

// Display values
pub const LINEAR_STR_U16: &[u16] = str_to_u16_slice!("linear");

// Direction values
pub const LYNX_RTL_STR_U16: &[u16] = str_to_u16_slice!("lynx-rtl");
pub const RTL_STR_U16: &[u16] = str_to_u16_slice!("rtl");

// Orientation values
pub const HORIZONTAL_STR_U16: &[u16] = str_to_u16_slice!("horizontal");
pub const HORIZONTAL_REVERSE_STR_U16: &[u16] = str_to_u16_slice!("horizontal-reverse");
pub const VERTICAL_STR_U16: &[u16] = str_to_u16_slice!("vertical");
pub const VERTICAL_REVERSE_STR_U16: &[u16] = str_to_u16_slice!("vertical-reverse");

// Flex direction values
pub const ROW_STR_U16: &[u16] = str_to_u16_slice!("row");
pub const ROW_REVERSE_STR_U16: &[u16] = str_to_u16_slice!("row-reverse");
pub const COLUMN_STR_U16: &[u16] = str_to_u16_slice!("column");
pub const COLUMN_REVERSE_STR_U16: &[u16] = str_to_u16_slice!("column-reverse");

// toggle pattern for linear orientation
pub const LYNX_LINEAR_ORIENTATION_TOGGLE_HORIZONTAL_VALUE_STR_U16: &[u16] =
  str_to_u16_slice!("var(--lynx-linear-orientation-horizontal)");
pub const LYNX_LINEAR_ORIENTATION_TOGGLE_HORIZONTAL_REVERSE_VALUE_STR_U16: &[u16] =
  str_to_u16_slice!("var(--lynx-linear-orientation-horizontal-reverse)");
pub const LYNX_LINEAR_ORIENTATION_TOGGLE_VERTICAL_VALUE_STR_U16: &[u16] =
  str_to_u16_slice!("var(--lynx-linear-orientation-vertical)");
pub const LYNX_LINEAR_ORIENTATION_TOGGLE_VERTICAL_REVERSE_VALUE_STR_U16: &[u16] =
  str_to_u16_slice!("var(--lynx-linear-orientation-vertical-reverse)");

// Gravity values
pub const TOP_STR_U16: &[u16] = str_to_u16_slice!("top");
pub const BOTTOM_STR_U16: &[u16] = str_to_u16_slice!("bottom");
pub const LEFT_STR_U16: &[u16] = str_to_u16_slice!("left");
pub const RIGHT_STR_U16: &[u16] = str_to_u16_slice!("right");
pub const CENTER_STR_U16: &[u16] = str_to_u16_slice!("center");
pub const CENTER_VERTICAL_STR_U16: &[u16] = str_to_u16_slice!("center-vertical");
pub const CENTER_HORIZONTAL_STR_U16: &[u16] = str_to_u16_slice!("center-horizontal");
pub const START_STR_U16: &[u16] = str_to_u16_slice!("start");
pub const END_STR_U16: &[u16] = str_to_u16_slice!("end");
pub const SPACE_BETWEEN_STR_U16: &[u16] = str_to_u16_slice!("space-between");
pub const STRETCH_STR_U16: &[u16] = str_to_u16_slice!("stretch");
pub const FILL_VERTICAL_STR_U16: &[u16] = str_to_u16_slice!("fill-vertical");
pub const FILL_HORIZONTAL_STR_U16: &[u16] = str_to_u16_slice!("fill-horizontal");

// CSS properties and values
pub const LYNX_DISPLAY_TOGGLE_STR_U16: &[u16] = str_to_u16_slice!("--lynx-display-toggle");
pub const LYNX_DISPLAY_STR_U16: &[u16] = str_to_u16_slice!("--lynx-display");
pub const LYNX_DISPLAY_LINEAR_VAR_STR_U16: &[u16] = str_to_u16_slice!("var(--lynx-display-linear)");
pub const LYNX_DISPLAY_FLEX_VAR_STR_U16: &[u16] = str_to_u16_slice!("var(--lynx-display-flex)");

pub const LYNX_LINEAR_ORIENTATION_STR_U16: &[u16] = str_to_u16_slice!("--lynx-linear-orientation");
pub const LYNX_LINEAR_ORIENTATION_TOGGLE_STR_U16: &[u16] =
  str_to_u16_slice!("--lynx-linear-orientation-toggle");

pub const FLEX_START_STR_U16: &[u16] = str_to_u16_slice!("flex-start");
pub const FLEX_END_STR_U16: &[u16] = str_to_u16_slice!("flex-end");
pub const ALIGN_ITEMS_STR_U16: &[u16] = str_to_u16_slice!("align-items");

pub const JUSTIFY_CONTENT_COLUMN_STR_U16: &[u16] = str_to_u16_slice!("--justify-content-column");
pub const JUSTIFY_CONTENT_COLUMN_REVERSE_STR_U16: &[u16] =
  str_to_u16_slice!("--justify-content-column-reverse");
pub const JUSTIFY_CONTENT_ROW_STR_U16: &[u16] = str_to_u16_slice!("--justify-content-row");
pub const JUSTIFY_CONTENT_ROW_REVERSE_STR_U16: &[u16] =
  str_to_u16_slice!("--justify-content-row-reverse");

pub const ALIGN_SELF_ROW_STR_U16: &[u16] = str_to_u16_slice!("--align-self-row");
pub const ALIGN_SELF_COLUMN_STR_U16: &[u16] = str_to_u16_slice!("--align-self-column");

pub const INVALID_STR_U16: &[u16] = str_to_u16_slice!("--lynx-invalid-invalid-invalid");
