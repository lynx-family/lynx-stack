use crate::*;
use crate::{char_code_definitions, types::*};
use std::iter::Peekable;
use std::str::{self, Chars};

pub fn cmp_str(test_str: &js_sys::JsString, start: u32, end: u32, reference_str: &[u32]) -> bool {
  if (end - start) as usize != reference_str.len() {
    return false;
  }
  if end > test_str.length() {
    return false;
  }
  for i in start..end {
    let reference_str_offset = i - start;
    if reference_str_offset as usize >= reference_str.len() || i >= test_str.length() {
      return false;
    }
    let reference_code = reference_str[reference_str_offset as usize];
    let mut test_code = test_str.char_code_at(i as u32) as u32;
    // testCode.toLowerCase() for A..Z
    if is_uppercase_letter!(test_code) {
      test_code |= 32;
    }
    if test_code != reference_code {
      return false;
    }
  }
  true
}

pub fn find_white_space_end(chars_clone: &mut Peekable<Chars>, offset: usize) -> usize {
  let mut offset = offset;
  while let Some(c) = chars_clone.next() {
    let code = c as u32;
    if !is_white_space!(code) {
      break;
    }
    offset += c.len_utf8();
  }
  offset
}

pub fn find_decimal_number_end(
  chars: &mut Peekable<std::str::Chars>,
  offset: usize,
  curChar: &mut Option<char>,
) -> usize {
  let mut offset = offset;
  while let Some(c) = chars.next() {
    let code = c as u32;
    *curChar = Some(c);
    if !is_digit!(code) {
      break;
    }
    offset += c.len_utf8();
  }
  offset
}

// § 4.3.7. Consume an escaped code point
pub fn consume_escaped(chars: &mut Peekable<Chars>, offset: usize) -> usize {
  // It assumes that the U+005C REVERSE SOLIDUS (\) has already been consumed and
  // that the next input code point has already been verified to be part of a valid escape.
  let mut offset = offset + 2;
  if let Some(next_c) = chars.next() {
    let next_code = next_c as u32;
    // let next_next_code = chars.next();

    // hex digit
    if is_hex_digit!(next_code) {
      // It assumes that the U+005C REVERSE SOLIDUS (\) has already been consumed and
      // that the next input code point has already been verified to be part of a valid escape.
      // let max_offset = core::cmp::min(offset + 5, source_length);

      let max_offset = offset + 5;
      let mut last_char: Option<char> = None;
      while let Some(next_next_c) = chars.next() {
        if offset < max_offset {
          if !is_hex_digit!(next_next_c as u32) {
            break;
          }
          offset += 1;
        } else {
          break;
        }
        last_char = Some(next_next_c);
      }

      // If the next input code point is whitespace, consume it as well.
      if let Some(c) = last_char {
        let code = c as u32;
        if is_white_space!(code) {
          offset += get_new_line_length!(chars, code);
        }
      }
    }
  };
  offset
}

// §4.3.11. Consume a name
// Note: This algorithm does not do the verification of the first few code points that are necessary
// to ensure the returned code points would constitute an <ident-token>. If that is the intended use,
pub fn consume_name(chars: &mut Peekable<Chars>, offset: usize) -> usize {
  let mut offset = offset;
  // Let result initially be an empty string.
  // Repeatedly consume the next input code point from the stream:
  let mut chars_clone = chars.clone();
  while let Some(c) = chars_clone.next() {
    let code = c as u32;
    if is_name!(code) {
      // Append the code point to result.
      offset += c.len_utf8();
      chars.next();
      continue;
    }

    // the stream starts with a valid escape
    if let Some(next_c) = chars_clone.peek() {
      if is_valid_escape!(code, (*next_c) as u32) {
        // Consume an escaped code point. Append the returned code point to result.
        offset = consume_escaped(chars, offset) - 1;
        offset += c.len_utf8();
        chars.next();
        continue;
      }
    }

    // anything else
    // Reconsume the current input code point. Return result.
    break;
  }
  offset
}

// §4.3.12. Consume a number
pub fn consume_number(
  chars: &mut Peekable<std::str::Chars>,
  cur_char: &mut Option<char>,
  offset: usize,
) -> usize {
  let mut offset = offset;

  // 2. If the next input code point is U+002B PLUS SIGN (+) or U+002D HYPHEN-MINUS (-),
  // consume it and append it to repr.
  if cur_char.is_some() && (cur_char.unwrap() == '+' || cur_char.unwrap() == '-') {
    *cur_char = chars.next();
    offset += 1;
  }

  if cur_char.is_some() {
    let code = cur_char.unwrap() as u32;
    // 3. While the next input code point is a digit, consume it and append it to repr.
    if is_digit!(code) {
      offset = find_decimal_number_end(chars, offset + 1, cur_char);
    }

    if let Some(next_c) = chars.peek() {
      let code = cur_char.unwrap() as u32;
      // 4. If the next 2 input code points are U+002E FULL STOP (.) followed by a digit, then:
      if code == 0x002E && is_digit!(*next_c as u32) {
        // 4.1 Consume them.
        // 4.2 Append them to repr.
        chars.next();
        *cur_char = chars.next();
        offset += 2;

        // 4.3 Set type to "number".
        // TODO

        // 4.4 While the next input code point is a digit, consume it and append it to repr.

        offset = find_decimal_number_end(chars, offset, cur_char);
      }
    }
  }

  if cmp_char!(&cur_char, 101 /* e */) != 0 {
    let mut sign = 0;
    if let Some(next_c) = chars.peek() {
      let mut code = *next_c as u32;
      let mut is_nan = false;
      // ... optionally followed by U+002D HYPHEN-MINUS (-) or U+002B PLUS SIGN (+) ...
      if code == 0x002D || code == 0x002B {
        sign = 1;
        let mut peek_iter = chars.clone();
        peek_iter.next();
        if let Some(next_next_c) = peek_iter.next() {
          code = next_next_c as u32;
        } else {
          is_nan = true;
        }
      }

      // ... followed by a digit
      if !is_nan && is_digit!(code) {
        // 5.1 Consume them.
        // 5.2 Append them to repr.

        // 5.3 Set type to "number".
        // TODO

        // 5.4 While the next input code point is a digit, consume it and append it to repr.
        let n = offset + 1 + sign;
        for _ in 0..n {
          *cur_char = chars.next();
        }
        offset = find_decimal_number_end(chars, offset + 1 + sign + 1, cur_char);
      }
    }
  }
  offset
}

// § 4.3.14. Consume the remnants of a bad url
// ... its sole use is to consume enough of the input stream to reach a recovery point
// where normal tokenizing can resume.
pub fn consume_bad_url_remnants(source: &js_sys::JsString, offset: u32) -> u32 {
  let source_length = source.length();
  let mut offset = offset;
  // Repeatedly consume the next input code point from the stream:
  while offset < source_length {
    let code = source.char_code_at(offset) as u32;
    // U+0029 RIGHT PARENTHESIS ())
    // EOF
    if code == 0x0029 {
      return offset + 1;
    }

    if is_valid_escape!(code, get_char_code!(source, source_length, offset + 1)) {
      // Consume an escaped code point.
      // Note: This allows an escaped right parenthesis ("\)") to be encountered
      // without ending the <bad-url-token>. This is otherwise identical to
      // the "anything else" clause.
      offset = consume_escaped(source, offset);
    }
    offset += 1;
  }
  offset
}

pub fn consume_string_token(
  chars: &mut Peekable<Chars>,
  ending_code_point: u32,
  offset: &mut usize,
  token_type: &mut u16,
) {
  *token_type = STRING_TOKEN;
  while let Some(c) = chars.next() {
    let code = c as u32;
    let char_code = char_code_category!(code);
    // ending code point
    if char_code == ending_code_point {
      // Return the <string-token>.
      (*offset) += c.len_utf8();
      return;

      // EOF
      // EofCategory:
      // This is a parse error. Return the <string-token>.
      // return;
    }

    match char_code {
      // newline
      char_code_definitions::WHITE_SPACE_CATEGORY => {
        if is_newline!(code) {
          // This is a parse error. Reconsume the current input code point,
          // create a <bad-string-token>, and return it.
          *offset += get_new_line_length!(chars, code);
          *token_type = BAD_STRING_TOKEN;
          return;
        }
      }
      // U+005C REVERSE SOLIDUS (\)
      0x005C => {
        // If the next input code point is EOF, do nothing.
        if chars.peek().is_none() {
          *offset += 1;
          continue;
        }

        if let Some(next_char) = chars.peek() {
          let next_code = *next_char as u32;
          // Otherwise, if the next input code point is a newline, consume it.
          if is_newline!(next_code) {
            chars.next();
            *offset += get_new_line_length!(chars, next_code);
          } else if is_valid_escape!(code, next_code) {
            // Otherwise, (the stream starts with a valid escape) consume
            // an escaped code point and append the returned code point to
            // the <string-token>’s value.
            // *offset = consume_escaped(source, *offset) - 1;
            *offset = consume_escaped(chars, *offset) - 1;
          }
        } else {
          // If the next input code point is EOF, do nothing.
          *offset += c.len_utf8();
          continue;
        }
      }
      _ => {} // anything else
              // Append the current input code point to the <string-token>’s value.
    }

    *offset += c.len_utf8();
  }
}

// § 4.3.3. Consume a numeric token
pub fn consume_numeric_token(
  chars: &mut Peekable<std::str::Chars>,
  offset: &mut usize,
  token_type: &mut u16,
  char: char,
) {
  let mut cur_char = Some(char);
  // Consume a number and let number be the result.
  *offset = consume_number(chars, &mut cur_char, *offset);

  // If the next 3 input code points would start an identifier, then:
  if is_identifier_start!(chars, code) {
    // Create a <dimension-token> with the same value and type flag as number, and a unit set initially to the empty string.
    // Consume a name. Set the <dimension-token>’s unit to the returned value.
    // Return the <dimension-token>.
    *token_type = DIMENSION_TOKEN;
    *offset = consume_name(chars, *offset, &mut cur_char);
    return;
  }

  // Otherwise, if the next input code point is U+0025 PERCENTAGE SIGN (%), consume it.
  if get_char_code!(source, source_length, *offset) == 0x0025 {
    // Create a <percentage-token> with the same value as number, and return it.
    *token_type = PERCENTAGE_TOKEN;
    (*offset) += 1;
    return;
  }

  // Otherwise, create a <number-token> with the same value and type flag as number, and return it.
  *token_type = NUMBER_TOKEN;
}
