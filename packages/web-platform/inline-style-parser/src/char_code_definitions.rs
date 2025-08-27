pub const EOF_CATEGORY: u8 = 0x80;
pub const WHITE_SPACE_CATEGORY: u8 = 0x82;
pub const DIGIT_CATEGORY: u8 = 0x83;
pub const NAME_START_CATEGORY: u8 = 0x84;
pub const NON_PRINTABLE_CATEGORY: u8 = 0x85;

// Character category constants

// Public character check macros (mirroring C macros)

// A code point between U+0030 DIGIT ZERO (0) and U+0039 DIGIT NINE (9).
#[inline(always)]
pub const fn is_digit(code: u8) -> bool {
  (code >= 0x30_u8) && (code <= 0x39_u8)
}

// A digit, or a code point between U+0041 (A) and U+0046 (F),
// or a code point between U+0061 (a) and U+0066 (f).
#[inline(always)]
pub const fn is_hex_digit(code: u8) -> bool {
  is_digit(code)
        || ((code >= 0x41) && (code <= 0x46)) // A-F
        || ((code >= 0x61) && (code <= 0x66)) // a-f
}

// A code point between U+0041 (A) and U+005A (Z).
#[inline(always)]
pub const fn is_uppercase_letter(code: u8) -> bool {
  (code >= 0x41) && (code <= 0x5A)
}

// A code point between U+0061 (a) and U+007A (z).
#[inline(always)]
pub const fn is_lowercase_letter(code: u8) -> bool {
  (code >= 0x61) && (code <= 0x7A)
}

// An uppercase letter or a lowercase letter.
#[inline(always)]
pub const fn is_letter(code: u8) -> bool {
  is_uppercase_letter(code) || is_lowercase_letter(code)
}

// A code point with a value equal to or greater than U+0080 <control>.
#[inline(always)]
pub const fn is_non_ascii(code: u8) -> bool {
  code >= 0x80
}

// A letter, a non-ASCII code point, or U+005F LOW LINE (_).
#[inline(always)]
pub const fn is_name_start(code: u8) -> bool {
  is_letter(code) || is_non_ascii(code) || code == 0x5F
}

// A name-start code point, a digit, or U+002D HYPHEN-MINUS (-).
#[inline(always)]
pub const fn is_name(code: u8) -> bool {
  is_name_start(code) || is_digit(code) || code == 0x2D
}

// A code point between U+0000 NULL and U+0008 BACKSPACE, or U+000B LINE TABULATION,
// or a code point between U+000E SHIFT OUT and U+001F INFORMATION SEPARATOR ONE, or U+007F DELETE.
#[inline(always)]
pub const fn is_non_printable(code: u8) -> bool {
  (code <= 0x08) || (code == 0x0B) || ((code >= 0x0E) && (code <= 0x1F)) || (code == 0x7F)
}

// U+000A LINE FEED. (Also U+000D CR and U+000C FF for preprocessing equivalence)
#[inline(always)]
pub const fn is_newline(code: u8) -> bool {
  (code == 0x0A_u8) || (code == 0x0D_u8) || (code == 0x0C_u8)
}

// A newline, U+0009 CHARACTER TABULATION, or U+0020 SPACE.
#[inline(always)]
pub const fn is_white_space(code: u8) -> bool {
  is_newline(code) || code == 0x09_u8 || code == 0x20_u8
}

// Check if two code points are a valid escape.
// If the first code point is not U+005C REVERSE SOLIDUS (\), return false.
// Otherwise, if the second code point is a newline or EOF (0), return false.
#[inline(always)]
pub const fn is_valid_escape(first: u8, second: u8) -> bool {
  (first == 0x5C) && !is_newline(second) && (second != 0)
}

// Check for Byte Order Mark
#[inline(always)]
pub fn get_start_offset(source: &[u8]) -> usize {
  let bom = "\u{FEFF}".as_bytes();
  let bom_le = "\u{FFFE}".as_bytes();
  if bom.len() < source.len()
    && (&source[0..bom.len()] == bom || &source[0..bom_le.len()] == bom_le)
  {
    3usize // BOM found
  } else {
    0usize
  }
}

// Check if three code points would start an identifier.
#[inline(always)]
pub fn is_identifier_start(first: u8, second: u8, third: u8) -> bool {
  /* Look at the first code point:
  U+002D HYPHEN-MINUS */
  if first == 0x2D {
    /* If the second code point is a name-start code point, return true. */
    /* or the second and third code points are a valid escape, return true. Otherwise, return false. */
    is_name_start(second) || (second == 0x2D) || is_valid_escape(second, third)
  /* name-start code point */
  } else if is_name_start(first) {
    true
  /*U+005C REVERSE SOLIDUS (\)*/
  } else if first == 0x5C {
    /* If the second code point is a name-start code point, return true. Otherwise, return false.*/
    is_valid_escape(first, second)
  } else {
    false
  }
}

// Check if three code points would start a number.
#[inline(always)]
pub fn is_number_start(first: u8, second: u8, third: u8) -> bool {
  if first == 0x2B || first == 0x2D {
    // U+002B PLUS SIGN (+) or U+002D HYPHEN-MINUS (-)
    if is_digit(second) {
      true
    } else {
      (second == 0x2E) && is_digit(third) // U+002E FULL STOP (.)
    }
  } else if first == 0x2E {
    // U+002E FULL STOP (.)
    is_digit(second)
  } else {
    is_digit(first)
  }
}

// Get the category of a character code.
#[inline(always)]
pub fn char_code_category(char_code: u8) -> u8 {
  match char_code {
    0 => EOF_CATEGORY,
    c if c >= 0x80 => {
      // For char_code >= 0x80, it's considered NameStart_Category.
      // This aligns with CSS syntax where non-ASCII characters are name-start characters.
      NAME_START_CATEGORY
    }
    c if is_white_space(c) => WHITE_SPACE_CATEGORY,
    c if is_digit(c) => DIGIT_CATEGORY,
    c if is_name_start(c) => NAME_START_CATEGORY,
    c if is_non_printable(c) => NON_PRINTABLE_CATEGORY,
    _ => char_code,
  }
}

#[inline(always)]
pub fn cmp_char(
  test_str: &[u8],
  test_str_length: usize,
  offset: usize,
  reference_code: u8,
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
pub fn get_char_code(source: &[u8], offset: usize) -> u8 {
  if offset < source.len() {
    source[offset]
  } else {
    0 // EOF
  }
}

#[inline(always)]
pub fn get_new_line_length(source: &[u8], offset: usize, code: u8) -> usize {
  if code == 13 /* \r */ && get_char_code(source, offset + 1) == 10
  /* \n */
  {
    2
  } else {
    1
  }
}
