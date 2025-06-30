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

pub const COLOR_APPENDIX_FOR_GRADIENT: &'static [&'static [&'static [u16]; 2]] = &[
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

pub const COLOR_APPENDIX_FOR_NORMAL_COLOR: &'static [&'static [&'static [u16]; 2]] = &[
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

pub const FLEX_STR_U16: &[u16] = str_to_u16_slice!("flex");

pub const AUTO_STR_U16: &[u16] = str_to_u16_slice!("auto");

pub const NONE_STR_U16: &[u16] = str_to_u16_slice!("none");

pub const LINEAR_WEIGHT_SUM_STR_U16: &[u16] = str_to_u16_slice!("linear-weight-sum");

pub const LINEAR_WEIGHT_SUM_CSS_VAR_NAME: &[u16] = str_to_u16_slice!("--linear-weight-sum");

pub const LYNX_TEXT_BG_COLOR_STR_U16: &[u16] = str_to_u16_slice!("--lynx-text-bg-color");

pub const FLEX_NONE_TRANSFORMED_VALIES: &'static [&'static [&'static [u16]; 2]] = &[
  &[FLEX_SHRINK_CSS_VAR_NAME, str_to_u16_slice!("0")],
  &[FLEX_GROW_CSS_VAR_NAME, str_to_u16_slice!("0")],
  &[FLEX_BASIS_CSS_VAR_NAME, str_to_u16_slice!("auto")],
];

pub const FLEX_AUTO_TRANSFORMED_VALIES: &'static [&'static [&'static [u16]; 2]] = &[
  /*
   * --flex-shrink:1;
   * --flex-grow:1;
   * --flex-basis:auto;
   */
  &[FLEX_SHRINK_CSS_VAR_NAME, str_to_u16_slice!("1")],
  &[FLEX_GROW_CSS_VAR_NAME, str_to_u16_slice!("1")],
  &[FLEX_BASIS_CSS_VAR_NAME, str_to_u16_slice!("auto")],
];

pub const FLEX_SINGLE_VALUE_USE_GROW_TRANSFORMED_DEFAULT_VALUES: &'static [&'static [&'static [u16];
                     2]] = &[
  /*
   * flex: <flex-grow> 1 0
   */
  &[FLEX_SHRINK_CSS_VAR_NAME, str_to_u16_slice!("1")],
  &[FLEX_BASIS_CSS_VAR_NAME, str_to_u16_slice!("0%")],
];

pub const FLEX_SINGLE_VALUE_USE_BASIS_TRANSFORMED_DEFAULT_VALUES: &'static [&'static [&'static [u16];
                     2]] = &[
  /*
   * flex: 1 1 <flex-basis>
   */
  &[FLEX_SHRINK_CSS_VAR_NAME, str_to_u16_slice!("1")],
  &[FLEX_GROW_CSS_VAR_NAME, str_to_u16_slice!("1")],
];

pub const FLEX_GROW_CSS_VAR_NAME: &[u16] = str_to_u16_slice!("--flex-grow");

pub const FLEX_BASIS_CSS_VAR_NAME: &[u16] = str_to_u16_slice!("--flex-basis");

pub const FLEX_SHRINK_CSS_VAR_NAME: &[u16] = str_to_u16_slice!("--flex-shrink");
