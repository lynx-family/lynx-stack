// CSS Syntax Module Level 3
// https://www.w3.org/TR/css-syntax-3/

pub const EOF_TOKEN: u16 = 0; // <EOF-token>
pub const IDENT_TOKEN: u16 = 1; // <ident-token>
pub const FUNCTION_TOKEN: u16 = 2; // <function-token>
pub const AT_KEYWORD_TOKEN: u16 = 3; // <at-keyword-token>
pub const HASH_TOKEN: u16 = 4; // <hash-token>
pub const STRING_TOKEN: u16 = 5; // <string-token>
pub const BAD_STRING_TOKEN: u16 = 6; // <bad-string-token>
pub const URL_TOKEN: u16 = 7; // <url-token>
pub const BAD_URL_TOKEN: u16 = 8; // <bad-url-token>
pub const DELIM_TOKEN: u16 = 9; // <delim-token>
pub const NUMBER_TOKEN: u16 = 10; // <number-token>
pub const PERCENTAGE_TOKEN: u16 = 11; // <percentage-token>
pub const DIMENSION_TOKEN: u16 = 12; // <dimension-token>
pub const WHITESPACE_TOKEN: u16 = 13; // <whitespace-token>
pub const CDO_TOKEN: u16 = 14; // <CDO-token>
pub const CDC_TOKEN: u16 = 15; // <CDC-token>
pub const COLON_TOKEN: u16 = 16; // <colon-token>
pub const SEMICOLON_TOKEN: u16 = 17; // <semicolon-token>
pub const COMMA_TOKEN: u16 = 18; // <comma-token>
pub const LEFT_SQUARE_BRACKET_TOKEN: u16 = 19; // <[-token>
pub const RIGHT_SQUARE_BRACKET_TOKEN: u16 = 20; // <]-token>
pub const LEFT_PARENTHESES_TOKEN: u16 = 21; // <(-token>
pub const RIGHT_PARENTHESES_TOKEN: u16 = 22; // <)-token>
pub const LEFT_CURLY_BRACKET_TOKEN: u16 = 23; // <{-token>
pub const RIGHT_CURLY_BRACKET_TOKEN: u16 = 24; // <}-token>
pub const COMMENT_TOKEN: u16 = 25; // <comment-token>
