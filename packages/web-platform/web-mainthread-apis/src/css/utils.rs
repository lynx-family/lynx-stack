use crate::*;

pub fn cmp_str(test_str: &[u16], start: usize, end: usize, reference_str: &[u16]) -> bool {
  if (end - start) != reference_str.len() {
    return false;
  }
  if end > test_str.len() {
    return false;
  }
  for i in start..end {
    let reference_str_offset = i - start;
    if reference_str_offset >= reference_str.len() || i >= test_str.len() {
      return false;
    }
    let reference_code = reference_str[reference_str_offset];
    let mut test_code = test_str[i];
    // testCode.toLowerCase() for A..Z
    if is_uppercase_letter!(test_code) {
      test_code = test_code | 32;
    }
    if test_code != reference_code {
      return false;
    }
  }
  true
}

pub fn find_white_space_end(source: &[u16], offset: usize) -> usize {
  let mut offset = offset;
  while offset < source.len() {
    let code = source[offset];
    if !is_white_space!(code) {
      break;
    }
    offset += 1;
  }
  offset
}

pub fn find_decimal_number_end(source: &[u16], offset: usize) -> usize {
  let mut offset = offset;
  while offset < source.len() {
    let code = source[offset];
    if !is_digit!(code) {
      break;
    }
    offset += 1;
  }
  offset
}

// § 4.3.7. Consume an escaped code point
pub fn consume_escaped(source: &[u16], offset: usize) -> usize {
  // It assumes that the U+005C REVERSE SOLIDUS (\) has already been consumed and
  // that the next input code point has already been verified to be part of a valid escape.
  let mut offset = offset + 2;
  let source_length = source.len();
  // hex digit
  if is_hex_digit!(get_char_code!(source, source_length, offset - 1)) {
    // It assumes that the U+005C REVERSE SOLIDUS (\) has already been consumed and
    // that the next input code point has already been verified to be part of a valid escape.
    let max_offset = core::cmp::min(offset + 5, source_length);
    while offset < max_offset {
      if !is_hex_digit!(get_char_code!(source, source_length, offset)) {
        break;
      }
      offset += 1;
    }
    // If the next input code point is whitespace, consume it as well.
    let code = get_char_code!(source, source_length, offset);
    if is_white_space!(code) {
      offset += get_new_line_length!(source, source_length, offset, code);
    }
  }

  offset
}
// §4.3.11. Consume a name
// Note: This algorithm does not do the verification of the first few code points that are necessary
// to ensure the returned code points would constitute an <ident-token>. If that is the intended use,
pub fn consume_name(source: &[u16], offset: usize) -> usize {
  let mut offset = offset;
  // Let result initially be an empty string.
  // Repeatedly consume the next input code point from the stream:
  let source_length = source.len();
  while offset < source_length {
    let code = source[offset];
    if is_name!(code) {
      // Append the code point to result.
      offset += 1;
      continue;
    }

    // the stream starts with a valid escape
    if is_valid_escape!(code, get_char_code!(source, source_length, offset + 1)) {
      // Consume an escaped code point. Append the returned code point to result.
      offset = consume_escaped(source, offset) - 1;
      offset += 1;
      continue;
    }

    // anything else
    // Reconsume the current input code point. Return result.
    break;
  }
  offset
}

// §4.3.12. Consume a number
pub fn consume_number(source: &[u16], offset: usize) -> usize {
  let mut offset = offset;
  let source_length = source.len();
  if offset < source_length {
    let mut code: u16 = source[offset];
    // 2. If the next input code point is U+002B PLUS SIGN (+) or U+002D HYPHEN-MINUS (-),
    // consume it and append it to repr.
    if code == 0x002B || code == 0x002D {
      offset += 1;
    }
    if offset < source_length {
      code = source[offset];

      // 3. While the next input code point is a digit, consume it and append it to repr.
      if is_digit!(code) {
        offset = find_decimal_number_end(source, offset + 1);
      }
      if offset + 1 < source_length {
        code = source[offset];
        // 4. If the next 2 input code points are U+002E FULL STOP (.) followed by a digit, then:
        if code == 0x002E && is_digit!(source[offset + 1]) {
          // 4.1 Consume them.
          // 4.2 Append them to repr.
          offset += 2;

          // 4.3 Set type to "number".
          // TODO

          // 4.4 While the next input code point is a digit, consume it and append it to repr.

          offset = find_decimal_number_end(source, offset);
        }
      }
    }

    if cmp_char!(source, source_length, offset, 101_u16 /* e */) != 0 {
      let mut sign: usize = 0;
      if offset + 1 < source_length {
        code = source[offset + 1];
        let mut is_nan = false;
        // ... optionally followed by U+002D HYPHEN-MINUS (-) or U+002B PLUS SIGN (+) ...
        if code == 0x002D || code == 0x002B {
          sign = 1;
          if offset + 2 < source_length {
            code = source[offset + 2];
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
          offset = find_decimal_number_end(source, offset + 1 + sign + 1);
        }
      }
    }
  }

  offset
}

// § 4.3.14. Consume the remnants of a bad url
// ... its sole use is to consume enough of the input stream to reach a recovery point
// where normal tokenizing can resume.
pub fn consume_bad_url_remnants(source: &[u16], offset: usize) -> usize {
  let source_length = source.len();
  let mut offset = offset;
  // Repeatedly consume the next input code point from the stream:
  while offset < source_length {
    let code = source[offset];
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
