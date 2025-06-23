use crate::css::{char_code_definitions, types::*, utils::*};
use crate::*;

const URL_STR: [u16; 3] = ['u' as u16, 'r' as u16, 'l' as u16];
/**
 * this code forked from css-tree
 */

// § 4.3.3. Consume a numeric token
pub fn consume_numeric_token(source: &[u16], offset: &mut usize, token_type: &mut u16) {
  let source_length = source.len();
  // Consume a number and let number be the result.
  *offset = consume_number(source, *offset);

  // If the next 3 input code points would start an identifier, then:
  if is_identifier_start!(
    get_char_code!(source, source_length, *offset),
    get_char_code!(source, source_length, *offset + 1),
    get_char_code!(source, source_length, *offset + 2)
  ) {
    // Create a <dimension-token> with the same value and type flag as number, and a unit set initially to the empty string.
    // Consume a name. Set the <dimension-token>’s unit to the returned value.
    // Return the <dimension-token>.
    *token_type = DIMENSION_TOKEN;
    *offset = consume_name(source, *offset);
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

// § 4.3.4. Consume an ident-like token
pub fn consume_ident_like_token(source: &[u16], offset: &mut usize, token_type: &mut u16) {
  let name_start_offset = *offset;
  let source_length = source.len();

  // Consume a name, and let string be the result.
  *offset = consume_name(source, *offset);

  // If string’s value is an ASCII case-insensitive match for "url",
  // and the next input code point is U+0028 LEFT PARENTHESIS ((), consume it.
  if cmp_str(source, name_start_offset, *offset, &URL_STR)
    && get_char_code!(source, source_length, *offset) == 0x0028
  {
    // While the next two input code points are whitespace, consume the next input code point.
    *offset = find_white_space_end(source, (*offset) + 1);

    // If the next one or two input code points are U+0022 QUOTATION MARK ("), U+0027 APOSTROPHE ('),
    // or whitespace followed by U+0022 QUOTATION MARK (") or U+0027 APOSTROPHE ('),
    // then create a <function-token> with its value set to string and return it.
    if (get_char_code!(source, source_length, *offset) == 0x0022
      || get_char_code!(source, source_length, *offset) == 0x0027)
    {
      *token_type = FUNCTION_TOKEN;
      *offset = name_start_offset + 4;
      return;
    }

    // Otherwise, consume a url token, and return it.
    consume_url_token(source, offset, token_type);
    return;
  }

  // Otherwise, if the next input code point is U+0028 LEFT PARENTHESIS ((), consume it.
  // Create a <function-token> with its value set to string and return it.
  if (get_char_code!(source, source_length, *offset) == 0x0028) {
    *token_type = FUNCTION_TOKEN;
    (*offset) += 1;
    return;
  }

  // Otherwise, create an <ident-token> with its value set to string and return it.
  *token_type = IDENT_TOKEN;
}

pub fn consume_string_token(
  source: &[u16],
  ending_code_point: u16,
  offset: &mut usize,
  token_type: &mut u16,
) {
  let source_length = source.len();
  let mut ending_code_point = ending_code_point;
  // This algorithm may be called with an ending code point, which denotes the code point
  // that ends the string. If an ending code point is not specified,
  // the current input code point is used.
  if ending_code_point == 0 {
    ending_code_point = get_char_code!(source, source_length, *offset);
    *offset = (*offset) + 1;
  }

  // Initially create a <string-token> with its value set to the empty string.
  *token_type = STRING_TOKEN;
  loop {
    if (*offset) >= source_length {
      return;
    }
    let code = source[*offset];
    let char_code = char_code_category!(code as usize);
    // ending code point
    if char_code == ending_code_point {
      // Return the <string-token>.
      (*offset) += 1;
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
          *offset += get_new_line_length!(source, source_length, *offset, code);
          *token_type = BAD_STRING_TOKEN;
          return;
        }
      }

      // U+005C REVERSE SOLIDUS (\)
      0x005C_u16 => {
        // If the next input code point is EOF, do nothing.
        if *offset == source_length - 1 {
          *offset += 1;
          continue;
        }

        let next_code = get_char_code!(source, source_length, (*offset) + 1);

        // Otherwise, if the next input code point is a newline, consume it.
        if is_newline!(next_code) {
          *offset += get_new_line_length!(source, source_length, (*offset) + 1, next_code);
        } else if is_valid_escape!(code, next_code) {
          // Otherwise, (the stream starts with a valid escape) consume
          // an escaped code point and append the returned code point to
          // the <string-token>’s value.
          *offset = consume_escaped(source, *offset) - 1;
        }
      }
      _ => {} // anything else
              // Append the current input code point to the <string-token>’s value.
    }

    *offset += 1;
  }
}
// § 4.3.6. Consume a url token
// Note: This algorithm assumes that the initial "url(" has already been consumed.
// This algorithm also assumes that it’s being called to consume an "unquoted" value, like url(foo).
// A quoted value, like url("foo"), is parsed as a <function-token>. Consume an ident-like token
// automatically handles this distinction; this algorithm shouldn’t be called directly otherwise.
pub fn consume_url_token(source: &[u16], offset: &mut usize, token_type: &mut u16) {
  let source_length = source.len();
  // Initially create a <url-token> with its value set to the empty string.
  *token_type = URL_TOKEN;

  // Consume as much whitespace as possible.
  *offset = find_white_space_end(source, *offset);

  // Repeatedly consume the next input code point from the stream:
  loop {
    if (*offset) >= source_length {
      return;
    }
    let code = source[*offset];

    match char_code_category!(code as usize) {
      // U+0029 RIGHT PARENTHESIS ())
      0x0029 => {
        // Return the <url-token>.
        (*offset) += 1;
        return;

        // EOF
        // EofCategory:
        // This is a parse error. Return the <url-token>.
        // return;
      }
      // whitespace
      char_code_definitions::WHITE_SPACE_CATEGORY => {
        // Consume as much whitespace as possible.
        *offset = find_white_space_end(source, *offset);

        // If the next input code point is U+0029 RIGHT PARENTHESIS ()) or EOF,
        // consume it and return the <url-token>
        // (if EOF was encountered, this is a parse error);
        if (get_char_code!(source, source_length, *offset) == 0x0029 || (*offset) >= source_length)
        {
          if (*offset) < source_length {
            (*offset) += 1;
          }
          return;
        }

        // otherwise, consume the remnants of a bad url, create a <bad-url-token>,
        // and return it.
        *offset = consume_bad_url_remnants(source, *offset);
        *token_type = BAD_URL_TOKEN;
        return;
      }

      // U+0022 QUOTATION MARK (")
      // U+0027 APOSTROPHE (')
      // U+0028 LEFT PARENTHESIS (()
      // non-printable code point
      0x0022 | 0x0027 | 0x0028 | char_code_definitions::NON_PRINTABLE_CATEGORY => {
        // This is a parse error. Consume the remnants of a bad url,
        // create a <bad-url-token>, and return it.
        *offset = consume_bad_url_remnants(source, *offset);
        *token_type = BAD_URL_TOKEN;
        return;
      }

      // U+005C REVERSE SOLIDUS (\)
      0x005C => {
        // If the stream starts with a valid escape, consume an escaped code point and
        // append the returned code point to the <url-token>’s value.
        if is_valid_escape!(code, get_char_code!(source, source_length, (*offset) + 1)) {
          *offset = consume_escaped(source, *offset) - 1;
          *offset += 1;
          continue;
        }

        // Otherwise, this is a parse error. Consume the remnants of a bad url,
        // create a <bad-url-token>, and return it.
        *offset = consume_bad_url_remnants(source, *offset);
        *token_type = BAD_URL_TOKEN;
        return;
      }
      _ => {
        // anything else
        // Append the current input code point to the <url-token>’s value.
      }
    }

    *offset += 1;
  }
}

pub trait Parser {
  fn on_token(&mut self, token_type: u16, start: usize, end: usize);
}

pub fn tokenize<T: Parser>(source: &[u16], parser: &mut T) {
  let source_length = source.len();
  let mut start: usize = is_bom!(get_char_code!(source, source_length, 0));
  let mut offset = start;
  let mut token_type: u16 = EOF_TOKEN;
  while offset < source_length {
    let code = source[offset];
    match char_code_category!(code as usize) {
      // whitespace
      char_code_definitions::WHITE_SPACE_CATEGORY => {
        // Consume as much whitespace as possible. Return a <whitespace-token>.
        token_type = WHITESPACE_TOKEN;
        offset = find_white_space_end(source, offset + 1);
      }
      // U+0022 QUOTATION MARK (")
      0x0022 => {
        // Consume a string token and return it.
        consume_string_token(source, 0, &mut offset, &mut token_type);
      }
      // U+0023 NUMBER SIGN (#)
      0x0023 => {
        // If the next input code point is a name code point or the next two input code points are a valid escape, then:
        if is_name!(get_char_code!(source, source_length, offset + 1))
          || is_valid_escape!(
            get_char_code!(source, source_length, offset + 1),
            get_char_code!(source, source_length, offset + 2)
          )
        {
          // Create a <hash-token>.
          token_type = HASH_TOKEN;

          // If the next 3 input code points would start an identifier, set the <hash-token>’s type flag to "id".
          // if (is_identifier_start!(get_char_code!(source, source_length, offset + 1), get_char_code!(source, source_length, offset + 2), get_char_code!(source, source_length, offset + 3))) {
          //     // TODO: set id flag
          // }

          // Consume a name, and set the <hash-token>’s value to the returned string.
          offset = consume_name(source, offset + 1);

          // Return the <hash-token>.
        } else {
          // Otherwise, return a <delim-token> with its value set to the current input code point.
          token_type = DELIM_TOKEN;
          offset += 1;
        }
      }
      // U+0027 APOSTROPHE (')
      0x0027 => {
        // Consume a string token and return it.
        consume_string_token(source, 0, &mut offset, &mut token_type);
      }

      // U+0028 LEFT PARENTHESIS (()
      0x0028 => {
        // Return a <(-token>.
        token_type = LEFT_PARENTHESES_TOKEN;
        offset += 1;
      }

      // U+0029 RIGHT PARENTHESIS ())
      0x0029 => {
        // Return a <)-token>.
        token_type = RIGHT_PARENTHESES_TOKEN;
        offset += 1;
      }

      // U+002B PLUS SIGN (+)
      0x002B => {
        // If the input stream starts with a number, ...
        if is_number_start!(
          code,
          get_char_code!(source, source_length, offset + 1),
          get_char_code!(source, source_length, offset + 2)
        ) {
          // ... reconsume the current input code point, consume a numeric token, and return it.
          consume_numeric_token(source, &mut offset, &mut token_type);
        } else {
          // Otherwise, return a <delim-token> with its value set to the current input code point.
          token_type = DELIM_TOKEN;
          offset += 1;
        }
      }

      // U+002C COMMA (,)
      0x002C => {
        // Return a <comma-token>.
        token_type = COMMA_TOKEN;
        offset += 1;
      }

      // U+002D HYPHEN-MINUS (-)
      0x002D => {
        // If the input stream starts with a number, reconsume the current input code point, consume a numeric token, and return it.
        if is_number_start!(
          code,
          get_char_code!(source, source_length, offset + 1),
          get_char_code!(source, source_length, offset + 2)
        ) {
          consume_numeric_token(source, &mut offset, &mut token_type);
        } else {
          // Otherwise, if the next 2 input code points are U+002D HYPHEN-MINUS U+003E GREATER-THAN SIGN (->), consume them and return a <CDC-token>.
          if get_char_code!(source, source_length, offset + 1) == 0x002D
            && get_char_code!(source, source_length, offset + 2) == 0x003E
          {
            token_type = CDC_TOKEN;
            offset = offset + 3;
          } else {
            // Otherwise, if the input stream starts with an identifier, ...
            if is_identifier_start!(
              code,
              get_char_code!(source, source_length, offset + 1),
              get_char_code!(source, source_length, offset + 2)
            ) {
              // ... reconsume the current input code point, consume an ident-like token, and return it.
              consume_ident_like_token(source, &mut offset, &mut token_type);
            } else {
              // Otherwise, return a <delim-token> with its value set to the current input code point.
              token_type = DELIM_TOKEN;
              offset += 1;
            }
          }
        }
      }

      // U+002E FULL STOP (.)
      0x002E => {
        // If the input stream starts with a number, ...
        if is_number_start!(
          code,
          get_char_code!(source, source_length, offset + 1),
          get_char_code!(source, source_length, offset + 2)
        ) {
          // ... reconsume the current input code point, consume a numeric token, and return it.
          consume_numeric_token(source, &mut offset, &mut token_type);
        } else {
          // Otherwise, return a <delim-token> with its value set to the current input code point.
          token_type = DELIM_TOKEN;
          offset += 1;
        }
      }

      // U+002F SOLIDUS (/)
      0x002F => {
        // If the next two input code point are U+002F SOLIDUS (/) followed by a U+002A ASTERISK (*),
        if (get_char_code!(source, source_length, offset + 1) == 0x002A) {
          // ... consume them and all following code points up to and including the first U+002A ASTERISK (*)
          // followed by a U+002F SOLIDUS (/), or up to an EOF code point.
          token_type = COMMENT_TOKEN;
          // implement of the indexOf function
          let mut is_found = false;
          for ii in offset + 2..source_length - 1 {
            if source[ii] == ('*' as u16) && source[ii + 1] == ('/' as u16) {
              is_found = true;
              offset = ii;
              break;
            }
          }
          if is_found {
            offset += 2; // consume the '*/'
          } else {
            offset = source_length; // consume until EOF
          }
        } else {
          token_type = DELIM_TOKEN;
          offset += 1;
        }
      }

      // U+003A COLON (:)
      0x003A => {
        // Return a <colon-token>.
        token_type = COLON_TOKEN;
        offset += 1;
      }

      // U+003B SEMICOLON (;)
      0x003B => {
        // Return a <semicolon-token>.
        token_type = SEMICOLON_TOKEN;
        offset += 1;
      }

      // U+003C LESS-THAN SIGN (<)
      0x003C => {
        // If the next 3 input code points are U+0021 EXCLAMATION MARK U+002D HYPHEN-MINUS U+002D HYPHEN-MINUS (!--), ...
        if get_char_code!(source, source_length, offset + 1) == 0x0021
          && get_char_code!(source, source_length, offset + 2) == 0x002D
          && get_char_code!(source, source_length, offset + 3) == 0x002D
        {
          // ... consume them and return a <CDO-token>.
          token_type = CDO_TOKEN;
          offset = offset + 4;
        } else {
          // Otherwise, return a <delim-token> with its value set to the current input code point.
          token_type = DELIM_TOKEN;
          offset += 1;
        }
      }

      // U+0040 COMMERCIAL AT (@)
      0x0040 => {
        // If the next 3 input code points would start an identifier, ...
        if is_identifier_start!(
          get_char_code!(source, source_length, offset + 1),
          get_char_code!(source, source_length, offset + 2),
          get_char_code!(source, source_length, offset + 3)
        ) {
          // ... consume a name, create an <at-keyword-token> with its value set to the returned value, and return it.
          token_type = AT_KEYWORD_TOKEN;
          offset = consume_name(source, offset + 1);
        } else {
          // Otherwise, return a <delim-token> with its value set to the current input code point.
          token_type = DELIM_TOKEN;
          offset += 1;
        }
      }

      // U+005B LEFT SQUARE BRACKET ([)
      0x005B => {
        // Return a <[-token>.
        token_type = LEFT_SQUARE_BRACKET_TOKEN;
        offset += 1;
      }

      // U+005C REVERSE SOLIDUS (\)
      0x005C => {
        // If the input stream starts with a valid escape, ...
        if is_valid_escape!(code, get_char_code!(source, source_length, offset + 1)) {
          // ... reconsume the current input code point, consume an ident-like token, and return it.
          consume_ident_like_token(source, &mut offset, &mut token_type);
        } else {
          // Otherwise, this is a parse error. Return a <delim-token> with its value set to the current input code point.
          token_type = DELIM_TOKEN;
          offset += 1;
        }
      }

      // U+005D RIGHT SQUARE BRACKET (])
      0x005D => {
        // Return a <]-token>.
        token_type = RIGHT_SQUARE_BRACKET_TOKEN;
        offset += 1;
      }

      // U+007B LEFT CURLY BRACKET ({)
      0x007B => {
        // Return a <{-token>.
        token_type = LEFT_CURLY_BRACKET_TOKEN;
        offset += 1;
      }

      // U+007D RIGHT CURLY BRACKET (})
      0x007D => {
        // Return a <}-token>.
        token_type = RIGHT_CURLY_BRACKET_TOKEN;
        offset += 1;
      }

      // digit
      char_code_definitions::DIGIT_CATEGORY => {
        // Reconsume the current input code point, consume a numeric token, and return it.
        consume_numeric_token(source, &mut offset, &mut token_type);
      }

      // name-start code point
      char_code_definitions::NAME_START_CATEGORY => {
        // Reconsume the current input code point, consume an ident-like token, and return it.
        consume_ident_like_token(source, &mut offset, &mut token_type);
      }

      // EOF
      // EofCategory:
      // Return an <EOF-token>.
      // break;

      // anything else
      _ => {
        // Return a <delim-token> with its value set to the current input code point.
        token_type = DELIM_TOKEN;
        offset += 1;
      }
    }
    parser.on_token(token_type, start, offset);
    start = offset;
  }
}
