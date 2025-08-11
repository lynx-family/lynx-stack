pub const EOF_CATEGORY: u16 = 0x80;
pub const WHITE_SPACE_CATEGORY: u16 = 0x82;
pub const DIGIT_CATEGORY: u16 = 0x83;
pub const NAME_START_CATEGORY: u16 = 0x84;
pub const NON_PRINTABLE_CATEGORY: u16 = 0x85;

const fn category_map_value_const(code: u16) -> u16 {
  if code == 0 {
    EOF_CATEGORY
  } else if is_white_space(code) {
    WHITE_SPACE_CATEGORY
  } else if is_digit(code) {
    DIGIT_CATEGORY
  } else if is_name_start(code) {
    NAME_START_CATEGORY
  } else if is_non_printable(code) {
    NON_PRINTABLE_CATEGORY
  } else {
    code
  }
}

const fn initialize_category_array() -> [u16; 0x80] {
  let mut arr = [0u16; 0x80];
  let mut i = 0;
  while i < 0x80 {
    arr[i] = category_map_value_const(i as u16);
    i += 1;
  }
  arr
}

pub const CATEGORY: [u16; 0x80] = initialize_category_array();
// Character category constants

// Public character check macros (mirroring C macros)

// A code point between U+0030 DIGIT ZERO (0) and U+0039 DIGIT NINE (9).
#[inline(always)]
pub const fn is_digit(code: u16) -> bool {
  (code >= 0x0030_u16) && (code <= 0x0039_u16)
}

// A digit, or a code point between U+0041 (A) and U+0046 (F),
// or a code point between U+0061 (a) and U+0066 (f).
#[inline(always)]
pub const fn is_hex_digit(code: u16) -> bool {
  is_digit(code)
        || ((code >= 0x0041) && (code <= 0x0046)) // A-F
        || ((code >= 0x0061) && (code <= 0x0066)) // a-f
}

// A code point between U+0041 (A) and U+005A (Z).
#[inline(always)]
pub const fn is_uppercase_letter(code: u16) -> bool {
  (code >= 0x0041) && (code <= 0x005A)
}

// A code point between U+0061 (a) and U+007A (z).
#[inline(always)]
pub const fn is_lowercase_letter(code: u16) -> bool {
  (code >= 0x0061) && (code <= 0x007A)
}

// An uppercase letter or a lowercase letter.
#[inline(always)]
pub const fn is_letter(code: u16) -> bool {
  is_uppercase_letter(code) || is_lowercase_letter(code)
}

// A code point with a value equal to or greater than U+0080 <control>.
#[inline(always)]
pub const fn is_non_ascii(code: u16) -> bool {
  code >= 0x0080
}

// A letter, a non-ASCII code point, or U+005F LOW LINE (_).
#[inline(always)]
pub const fn is_name_start(code: u16) -> bool {
  is_letter(code) || is_non_ascii(code) || code == 0x005F
}

// A name-start code point, a digit, or U+002D HYPHEN-MINUS (-).
#[inline(always)]
pub const fn is_name(code: u16) -> bool {
  is_name_start(code) || is_digit(code) || code == 0x002D
}

// A code point between U+0000 NULL and U+0008 BACKSPACE, or U+000B LINE TABULATION,
// or a code point between U+000E SHIFT OUT and U+001F INFORMATION SEPARATOR ONE, or U+007F DELETE.
#[inline(always)]
pub const fn is_non_printable(code: u16) -> bool {
  (code <= 0x0008) || (code == 0x000B) || ((code >= 0x000E) && (code <= 0x001F)) || (code == 0x007F)
}

// U+000A LINE FEED. (Also U+000D CR and U+000C FF for preprocessing equivalence)
#[inline(always)]
pub const fn is_newline(code: u16) -> bool {
  (code == 0x000A_u16) || (code == 0x000D_u16) || (code == 0x000C_u16)
}

// A newline, U+0009 CHARACTER TABULATION, or U+0020 SPACE.
#[inline(always)]
pub const fn is_white_space(code: u16) -> bool {
  is_newline(code) || code == 0x0009_u16 || code == 0x0020_u16
}

// Check if two code points are a valid escape.
// If the first code point is not U+005C REVERSE SOLIDUS (\), return false.
// Otherwise, if the second code point is a newline or EOF (0), return false.
#[inline(always)]
pub const fn is_valid_escape(first: u16, second: u16) -> bool {
  (first == 0x005C) && !is_newline(second) && (second != 0)
}

// Check for Byte Order Mark
#[inline(always)]
pub fn is_bom(code: u16) -> usize {
  if code == 0xFEFF || code == 0xFFFE {
    1usize
  } else {
    0usize
  }
}

// Check if three code points would start an identifier.
#[inline(always)]
pub fn is_identifier_start(first: u16, second: u16, third: u16) -> bool {
  /* Look at the first code point:
  U+002D HYPHEN-MINUS */
  if first == 0x002D {
    /* If the second code point is a name-start code point, return true. */
    /* or the second and third code points are a valid escape, return true. Otherwise, return false. */
    is_name_start(second) || (second == 0x002D) || is_valid_escape(second, third)
  /* name-start code point */
  } else if is_name_start(first) {
    true
  /*U+005C REVERSE SOLIDUS (\)*/
  } else if first == 0x005C {
    /* If the second code point is a name-start code point, return true. Otherwise, return false.*/
    is_valid_escape(first, second)
  } else {
    false
  }
}

// Check if three code points would start a number.
#[inline(always)]
pub fn is_number_start(first: u16, second: u16, third: u16) -> bool {
  if first == 0x002B || first == 0x002D {
    // U+002B PLUS SIGN (+) or U+002D HYPHEN-MINUS (-)
    if is_digit(second) {
      true
    } else {
      (second == 0x002E) && is_digit(third) // U+002E FULL STOP (.)
    }
  } else if first == 0x002E {
    // U+002E FULL STOP (.)
    is_digit(second)
  } else {
    is_digit(first)
  }
}

// Get the category of a character code.
#[inline(always)]
pub fn char_code_category(char_code: u16) -> u16 {
  if let Some(category) = crate::char_code_definitions::CATEGORY.get(char_code as usize) {
    *category
  } else {
    // For char_code >= 0x80, it's considered NameStart_Category.
    // This aligns with CSS syntax where non-ASCII characters are name-start characters.
    crate::char_code_definitions::NAME_START_CATEGORY
  }
}

#[inline(always)]
pub fn cmp_char(
  test_str: &[u16],
  test_str_length: usize,
  offset: usize,
  reference_code: u16,
) -> usize {
  if offset < test_str_length {
    let code = test_str[offset];
    // code.toLowerCase() for A..Z
    if code == reference_code || (is_uppercase_letter(code) && ((code | 32) == reference_code)) {
      1usize //true
    } else {
      0usize //false
    }
  } else {
    0usize //false
  }
}

#[inline(always)]
pub fn get_char_code(source: &[u16], source_length: usize, offset: usize) -> u16 {
  if offset < source_length {
    source[offset]
  } else {
    0 // EOF
  }
}

#[inline(always)]
pub fn get_new_line_length(
  source: &[u16],
  source_length: usize,
  offset: usize,
  code: u16,
) -> usize {
  if code == 13 /* \r */ && get_char_code(source, source_length, offset + 1) == 10
  /* \n */
  {
    2
  } else {
    1
  }
}
