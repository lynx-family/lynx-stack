use crate::{
  is_newline, is_white_space,
  tokenize::{self, Parser},
  types::*,
  utils::cmp_str,
};

const IMPORTANT_STR: [u32; 9] = [
  'i' as u32, 'm' as u32, 'p' as u32, 'o' as u32, 'r' as u32, 't' as u32, 'a' as u32, 'n' as u32,
  't' as u32,
];

pub struct ParserState<'a, 'b, T: Transformer> {
  transformer: &'b mut T,
  source: &'a js_sys::JsString,
  status: usize,
  name_start: u32,
  name_end: u32,
  value_start: u32,
  value_end: u32,
  is_important: bool,
  prev_token_type: u16,
}

impl<T: Transformer> Parser for ParserState<'_, '_, T> {
  fn on_token(&mut self, token_type: u16, start: u32, end: u32) {
    //https://drafts.csswg.org/css-syntax-3/#consume-declaration
    // on_token(type, start, offset);
    /*
    explain the status:code
       height   :    1px     !important   ;
    ^status = 0  ^status = 2
             ^status = 1
                        ^status = 3

    */
    if token_type == IDENT_TOKEN && self.status == 0 {
      /*
      1. If the next token is an <ident-token>, consume a token from input and set decl's name to the token’s value.
        Otherwise, consume the remnants of a bad declaration from input, with nested, and return nothing.
      */
      self.name_start = start;
      self.name_end = end;
      self.prev_token_type = token_type;
      self.status = 1;
    }
    // 2. Discard whitespace from input.
    else if self.status == 1 && token_type == WHITESPACE_TOKEN {
      // do nothing, just skip whitespace
    } else if self.status == 1 && token_type == COLON_TOKEN {
      /*
      3. If the next token is a <colon-token>, discard a token from input.
        Otherwise, consume the remnants of a bad declaration from input, with nested, and return nothing.
      */
      self.status = 2; // now find a value
    } else if self.status == 2
      && token_type != LEFT_CURLY_BRACKET_TOKEN
      && token_type != LEFT_PARENTHESES_TOKEN
      && token_type != LEFT_SQUARE_BRACKET_TOKEN
      && token_type != SEMICOLON_TOKEN
    {
      if token_type == WHITESPACE_TOKEN {
        // 4. Discard whitespace from input.
      } else {
        /*
          5. Consume a list of component values from input, with nested, and with <semicolon-token, and set decl’s value to the result.
          component values: A component value is one of the preserved tokens, a function, or a simple block.
          preserved tokens: Any token produced by the tokenizer except for <function-token>s, <{-token>s, <(-token>s, and <[-token>s.
          result: except  <{-token>s, <(-token>s, and <[-token>s
        */
        self.value_start = start;
        self.status = 3; // now find a semicolon
      }
    } else if self.status == 3 && token_type == SEMICOLON_TOKEN {
      /*
      6. If the next token is a <semicolon-token>, consume a token from input.
        Otherwise, consume the remnants of a bad declaration from input, with nested, and return nothing.
      */
      if self.value_end == 0 {
        self.value_end = start;
      }
      while is_white_space!(self.source.char_code_at(self.value_end - 1) as u32)
        && self.value_end > self.value_start
      {
        self.value_end -= 1;
      }
      self.transformer.on_declaration(
        self.name_start,
        self.name_end,
        self.value_start,
        self.value_end,
        self.is_important,
      );
      self.status = 0; // reset
      self.name_start = 0;
      self.name_end = 0;
      self.value_start = 0;
      self.value_end = 0;
      self.is_important = false;
    } else if self.status == 3
      && self.prev_token_type == DELIM_TOKEN
      && cmp_str(self.source, start, end, &IMPORTANT_STR)
    {
      // here we will have some bad caes: like
      // height: 1px !important 2px;
      // height: 1px /important;
      // we accept such limited cases for performance consideration
      self.is_important = true;
      self.value_end = start - 1;
    } else if self.status == 3
      && token_type != LEFT_CURLY_BRACKET_TOKEN
      && token_type != LEFT_PARENTHESES_TOKEN
      && token_type != LEFT_SQUARE_BRACKET_TOKEN
      && token_type != SEMICOLON_TOKEN
    {
      if token_type != WHITESPACE_TOKEN {
        self.value_end = end;
      }
    } else if self.status != 0 {
      // we have a bad declaration
      self.status = 0; // reset
      self.name_start = 0;
      self.name_end = 0;
      self.value_start = 0;
      self.value_end = 0;
      self.is_important = false;
    }
    self.prev_token_type = token_type;
  }
}

pub trait Transformer {
  fn on_declaration(
    &mut self,
    name_start: u32,
    name_end: u32,
    value_start: u32,
    value_end: u32,
    is_important: bool,
  );
}

pub fn parse_inline_style<'a, T: Transformer>(source: &js_sys::JsString, transformer: &mut T) {
  let mut parser = ParserState {
    transformer,
    source,
    status: 0,
    name_start: 0,
    name_end: 0,
    value_start: 0,
    value_end: 0,
    is_important: false,
    prev_token_type: WHITESPACE_TOKEN, // start with whitespace
  };
  tokenize::tokenize(source, &mut parser);
  if parser.prev_token_type != SEMICOLON_TOKEN {
    parser.on_token(SEMICOLON_TOKEN, source.length(), source.length());
  }
}
