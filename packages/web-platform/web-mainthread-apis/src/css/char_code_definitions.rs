use crate::*;

pub const EOF_CATEGORY: u16 = 0x80;
pub const WHITE_SPACE_CATEGORY: u16 = 0x82;
pub const DIGIT_CATEGORY: u16 = 0x83;
pub const NAME_START_CATEGORY: u16 = 0x84;
pub const NON_PRINTABLE_CATEGORY: u16 = 0x85;

const fn category_map_value_const(code: u16) -> u16 {
  if code == 0 {
    EOF_CATEGORY
  } else if is_white_space!(code) {
    WHITE_SPACE_CATEGORY
  } else if is_digit!(code) {
    DIGIT_CATEGORY
  } else if is_name_start!(code) {
    NAME_START_CATEGORY
  } else if is_non_printable!(code) {
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
#[macro_export]
macro_rules! is_digit {
  ($code:expr) => {
    ($code >= 0x0030_u16) && ($code <= 0x0039_u16)
  };
}

// A digit, or a code point between U+0041 (A) and U+0046 (F),
// or a code point between U+0061 (a) and U+0066 (f).
#[macro_export]
macro_rules! is_hex_digit {
    ($code:expr) => {
        (is_digit!($code)
            || (($code >= 0x0041) && ($code <= 0x0046)) // A-F
            || (($code >= 0x0061) && ($code <= 0x0066))) // a-f
    };
}

// A code point between U+0041 (A) and U+005A (Z).
#[macro_export]
macro_rules! is_uppercase_letter {
  ($code:expr) => {
    ($code >= 0x0041) && ($code <= 0x005A)
  };
}

// A code point between U+0061 (a) and U+007A (z).
#[macro_export]
macro_rules! is_lowercase_letter {
  ($code:expr) => {
    ($code >= 0x0061) && ($code <= 0x007A)
  };
}

// An uppercase letter or a lowercase letter.
#[macro_export]
macro_rules! is_letter {
  ($code:expr) => {
    (is_uppercase_letter!($code) || is_lowercase_letter!($code))
  };
}

// A code point with a value equal to or greater than U+0080 <control>.
#[macro_export]
macro_rules! is_non_ascii {
  ($code:expr) => {
    $code >= 0x0080
  };
}

// A letter, a non-ASCII code point, or U+005F LOW LINE (_).
#[macro_export]
macro_rules! is_name_start {
  ($code:expr) => {
    (is_letter!($code) || is_non_ascii!($code) || $code == 0x005F)
  };
}

// A name-start code point, a digit, or U+002D HYPHEN-MINUS (-).
#[macro_export]
macro_rules! is_name {
  ($code:expr) => {
    (is_name_start!($code) || is_digit!($code) || $code == 0x002D)
  };
}

// A code point between U+0000 NULL and U+0008 BACKSPACE, or U+000B LINE TABULATION,
// or a code point between U+000E SHIFT OUT and U+001F INFORMATION SEPARATOR ONE, or U+007F DELETE.
#[macro_export]
macro_rules! is_non_printable {
  ($code:expr) => {
    (($code <= 0x0008)
      || ($code == 0x000B)
      || (($code >= 0x000E) && ($code <= 0x001F))
      || ($code == 0x007F))
  };
}

// U+000A LINE FEED. (Also U+000D CR and U+000C FF for preprocessing equivalence)
#[macro_export]
macro_rules! is_newline {
  ($code:expr) => {
    ($code == 0x000A_u16) || ($code == 0x000D_u16) || ($code == 0x000C_u16)
  };
}

// A newline, U+0009 CHARACTER TABULATION, or U+0020 SPACE.
#[macro_export]
macro_rules! is_white_space {
  ($code:expr) => {
    (is_newline!($code) || $code == 0x0009_u16 || $code == 0x0020_u16)
  };
}

// Check if two code points are a valid escape.
// If the first code point is not U+005C REVERSE SOLIDUS (\), return false.
// Otherwise, if the second code point is a newline or EOF (0), return false.
#[macro_export]
macro_rules! is_valid_escape {
  ($first:expr, $second:expr) => {
    (($first == 0x005C) && !is_newline!($second) && ($second != 0))
  };
}

// Check for Byte Order Mark
#[macro_export]
macro_rules! is_bom {
  ($code:expr) => {
    if $code == 0xFEFF || $code == 0xFFFE {
      1usize
    } else {
      0usize
    }
  };
}

// Check if three code points would start an identifier.
#[macro_export]
macro_rules! is_identifier_start {
  ($first:expr, $second:expr, $third:expr) => {
    /* Look at the first code point:
       U+002D HYPHEN-MINUS */
    if $first == 0x002D {
      /* If the second code point is a name-start code point, return true. */
      /* or the second and third code points are a valid escape, return true. Otherwise, return false. */
      is_name_start!($second) || ($second == 0x002D) || is_valid_escape!($second, $third)
    /* name-start code point */
    } else if is_name_start!($first) {
      true
    /*U+005C REVERSE SOLIDUS (\)*/
    } else if $first == 0x005C {
      /* If the second code point is a name-start code point, return true. Otherwise, return false.*/
      is_valid_escape!($first, $second)
    } else {
      false
    }
  };
}

// Check if three code points would start a number.
#[macro_export]
macro_rules! is_number_start {
  ($first:expr, $second:expr, $third:expr) => {
    if $first == 0x002B || $first == 0x002D {
      // U+002B PLUS SIGN (+) or U+002D HYPHEN-MINUS (-)
      if is_digit!($second) {
        true
      } else {
        ($second == 0x002E) && is_digit!($third) // U+002E FULL STOP (.)
      }
    } else if $first == 0x002E {
      // U+002E FULL STOP (.)
      is_digit!($second)
    } else {
      is_digit!($first)
    }
  };
}

// Get the category of a character code.
#[macro_export]
macro_rules! char_code_category {
  ($char_code:expr) => {
    if $char_code < 0x80 {
      $crate::css::char_code_definitions::CATEGORY[$char_code]
    } else {
      // For char_code >= 0x80, it's considered NameStart_Category.
      // This aligns with CSS syntax where non-ASCII characters are name-start characters.
      $crate::css::char_code_definitions::NAME_START_CATEGORY
    }
  };
}

#[macro_export]
macro_rules! cmp_char {
  ($test_str:expr, $test_str_length:expr, $offset:expr, $reference_code:expr) => {{
    if ($offset < $test_str_length) {
      let code = $test_str[$offset];
      // code.toLowerCase() for A..Z
      if code == $reference_code || (is_uppercase_letter!(code) && ((code | 32) == $reference_code))
      {
        1usize //true
      } else {
        0usize //false
      }
    } else {
      0usize //false
    }
  }};
}

#[macro_export]
macro_rules! get_char_code {
  ($source:expr, $source_length:expr, $offset:expr) => {
    if $offset < $source_length {
      $source[$offset]
    } else {
      0 // EOF
    }
  };
}

#[macro_export]
macro_rules! get_new_line_length {
    ($source:expr, $source_length:expr, $offset:expr, $code:expr) => {
        if $code == 13 /* \r */ && get_char_code!($source, $source_length, $offset + 1) == 10 /* \n */ {
            2
        } else {
            1
        }
    }
}
