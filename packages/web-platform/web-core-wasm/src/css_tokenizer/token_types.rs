/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

// CSS Syntax Module Level 3
// https://www.w3.org/TR/css-syntax-3/

pub const EOF_TOKEN: u8 = 0; // <EOF-token>
pub const IDENT_TOKEN: u8 = 1; // <ident-token>
pub const FUNCTION_TOKEN: u8 = 2; // <function-token>
pub const AT_KEYWORD_TOKEN: u8 = 3; // <at-keyword-token>
pub const HASH_TOKEN: u8 = 4; // <hash-token>
pub const STRING_TOKEN: u8 = 5; // <string-token>
pub const BAD_STRING_TOKEN: u8 = 6; // <bad-string-token>
pub const URL_TOKEN: u8 = 7; // <url-token>
pub const BAD_URL_TOKEN: u8 = 8; // <bad-url-token>
pub const DELIM_TOKEN: u8 = 9; // <delim-token>
pub const NUMBER_TOKEN: u8 = 10; // <number-token>
pub const PERCENTAGE_TOKEN: u8 = 11; // <percentage-token>
pub const DIMENSION_TOKEN: u8 = 12; // <dimension-token>
pub const WHITESPACE_TOKEN: u8 = 13; // <whitespace-token>
pub const CDO_TOKEN: u8 = 14; // <CDO-token>
pub const CDC_TOKEN: u8 = 15; // <CDC-token>
pub const COLON_TOKEN: u8 = 16; // <colon-token>
pub const SEMICOLON_TOKEN: u8 = 17; // <semicolon-token>
pub const COMMA_TOKEN: u8 = 18; // <comma-token>
pub const LEFT_SQUARE_BRACKET_TOKEN: u8 = 19; // <[-token>
pub const RIGHT_SQUARE_BRACKET_TOKEN: u8 = 20; // <]-token>
pub const LEFT_PARENTHESES_TOKEN: u8 = 21; // <(-token>
pub const RIGHT_PARENTHESES_TOKEN: u8 = 22; // <)-token>
pub const LEFT_CURLY_BRACKET_TOKEN: u8 = 23; // <{-token>
pub const RIGHT_CURLY_BRACKET_TOKEN: u8 = 24; // <}-token>
pub const COMMENT_TOKEN: u8 = 25; // <comment-token>
