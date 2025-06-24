pub const IMPORTANT_STR_U16: &[u16] = &[
  b' ' as u16,
  b'!' as u16,
  b'i' as u16,
  b'm' as u16,
  b'p' as u16,
  b'o' as u16,
  b'r' as u16,
  b't' as u16,
  b'a' as u16,
  b'n' as u16,
  b't' as u16,
];

pub const COLOR_STR_U16: &[u16] = &[
  b'c' as u16,
  b'o' as u16,
  b'l' as u16,
  b'o' as u16,
  b'r' as u16,
];

pub const LINEAR_GRADIENT_STR_U16: &[u16] = &[
  b'l' as u16,
  b'i' as u16,
  b'n' as u16,
  b'e' as u16,
  b'a' as u16,
  b'r' as u16,
  b'-' as u16,
  b'g' as u16,
  b'r' as u16,
  b'a' as u16,
  b'd' as u16,
  b'i' as u16,
  b'e' as u16,
  b'n' as u16,
  b't' as u16,
];

pub const COLOR_APPENDIX_FOR_GRADIENT: &'static [&'static str] = &[
  "color:transparent",
  "-webkit-background-clip:text",
  "background-clip:text",
];

pub const COLOR_APPENDIX_FOR_NORMAL_COLOR: &'static [&'static str] = &[
  "--lynx-text-bg-color:initial",
  "-webkit-background-clip:initial",
  "background-clip:initial",
];
