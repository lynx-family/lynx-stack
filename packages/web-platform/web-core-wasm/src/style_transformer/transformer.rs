/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
use super::token_transformer::transform_one_token;
#[cfg(any(feature = "client", feature = "server", test))]
use crate::css_tokenizer::tokenize;
use crate::css_tokenizer::{
  char_code_definitions::is_white_space, token_types::*, tokenize::Parser,
};
use crate::template::template_sections::style_info::css_property::{
  CSSProperty, ParsedDeclaration,
};

use super::rules::query_transform_rules;

pub struct StyleTransformer<'a, T: Generator> {
  generator: &'a mut T,

  status: usize,
  current_property_id: Option<CSSProperty>,
  current_value: String,
  is_important: bool,
  prev_token_type: u8,
}

pub trait Generator {
  fn push_transformed_style(&mut self, value: String);
  fn push_transform_kids_style(&mut self, value: String);
}

impl<'a, T: Generator> Parser for StyleTransformer<'a, T> {
  fn on_token(&mut self, token_type: u8, token_value: &str) {
    let (token_type, token_value) = transform_one_token(token_type, token_value);
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
      self.current_property_id = Some(token_value.into());
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
        self.current_value.push_str(&token_value);
        self.status = 3; // now find a semicolon
      }
    } else if self.status == 3 && token_type == SEMICOLON_TOKEN {
      /*
      6. If the next token is a <semicolon-token>, consume a token from input.
        Otherwise, consume the remnants of a bad declaration from input, with nested, and return nothing.
      */
      while !self.current_value.is_empty()
        && is_white_space(*self.current_value.as_bytes().last().unwrap_or(&0))
      {
        self.current_value.pop();
      }
      assert!(
        self.current_property_id.is_some(),
        "property name should be set before semicolon"
      );
      let property_id = self.current_property_id.take().unwrap();
      // create a string with buf size 8 chars
      let property_value = std::mem::replace(&mut self.current_value, String::with_capacity(8));
      self.status = 0; // reset
      self.on_declaration_parsed(property_id, property_value, self.is_important);
      self.is_important = false;
    } else if self.status == 3
      && self.prev_token_type == DELIM_TOKEN
      && token_value.eq_ignore_ascii_case("important")
    {
      // here we will have some bad cases: like
      // height: 1px !important 2px;
      // height: 1px /important;
      // we accept such limited cases for performance consideration
      self.is_important = true;
      self.current_value.pop(); // remove the '!' char
    } else if self.status == 3
      && token_type != LEFT_CURLY_BRACKET_TOKEN
      && token_type != LEFT_PARENTHESES_TOKEN
      && token_type != LEFT_SQUARE_BRACKET_TOKEN
      && token_type != SEMICOLON_TOKEN
    {
      self.current_value.push_str(&token_value);
    } else if self.status != 0 {
      // we have a bad declaration
      self.status = 0; // reset
      self.current_property_id = None;
      self.current_value = String::with_capacity(8);
      self.is_important = false;
    }
    self.prev_token_type = token_type;
  }
}
impl<'a, T: Generator> StyleTransformer<'a, T> {
  pub fn new(generator: &'a mut T) -> Self {
    StyleTransformer {
      generator,
      status: 0,
      current_property_id: None,
      current_value: String::with_capacity(8),
      is_important: false,
      prev_token_type: WHITESPACE_TOKEN, // start with whitespace
    }
  }

  #[cfg(any(feature = "client", feature = "server", test))]
  pub fn parse(&mut self, source: &str) {
    tokenize::tokenize(source, self);
    if self.prev_token_type != SEMICOLON_TOKEN {
      self.on_token(SEMICOLON_TOKEN, ";");
    }
  }

  pub(crate) fn on_declaration_parsed(
    &mut self,
    property_id: CSSProperty,
    property_value: String,
    is_important: bool,
  ) {
    let empty: bool = {
      let (current_declarations, kids_declarations) =
        query_transform_rules(&property_id, &property_value);
      for (property_str, property_value) in kids_declarations.into_iter() {
        self
          .generator
          .push_transform_kids_style(generate_one_declaration(
            property_str,
            property_value,
            is_important,
          ));
      }
      if current_declarations.is_empty() {
        true
      } else {
        for (property_str, property_value) in current_declarations.into_iter() {
          self
            .generator
            .push_transformed_style(generate_one_declaration(
              property_str,
              property_value,
              is_important,
            ));
        }
        false
      }
    };
    if empty {
      self
        .generator
        .push_transformed_style(generate_one_declaration(
          &property_id.to_string(),
          &property_value,
          is_important,
        ));
    }
  }

  pub fn on_half_parsed_declaration(&mut self, parsed_declaration: ParsedDeclaration) {
    self.on_declaration_parsed(
      parsed_declaration.property_id,
      parsed_declaration
        .value_token_list
        .iter()
        .map(|t| {
          let (_, token_value) = transform_one_token(t.token_type, &t.value);
          token_value
        })
        .collect(),
      parsed_declaration.is_important,
    );
  }
}

#[inline(always)]
fn generate_one_declaration(
  property_string: &str,
  value_string: &str,
  is_important: bool,
) -> String {
  format!(
    "{property_string}:{value_string}{}",
    if is_important { " !important;" } else { ";" }
  )
}

#[cfg(test)]
mod tests {
  use super::Generator;

  struct TestTransformer {
    pub declarations: Vec<String>,
  }

  impl Generator for TestTransformer {
    fn push_transform_kids_style(&mut self, value: String) {
      self.declarations.push(value);
    }

    fn push_transformed_style(&mut self, value: String) {
      self.declarations.push(value);
    }
  }

  fn parse_css(css: &str) -> (TestTransformer, &str) {
    let mut test_transformer = TestTransformer {
      declarations: Vec::new(),
    };
    let mut style_transformer = super::StyleTransformer::new(&mut test_transformer);
    style_transformer.parse(css);
    (test_transformer, css)
  }

  #[test]
  fn test_basic_declaration() {
    let (transformer, _) = parse_css("background-color: red;");

    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(transformer.declarations[0], "background-color:red;");
  }

  #[test]
  fn test_important_declaration() {
    let (transformer, _) = parse_css("background-color: red !important;");

    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.declarations[0],
      "background-color:red !important;"
    );
  }

  #[test]
  fn test_multiple_declarations() {
    let (transformer, _) =
      parse_css("background-color: red; margin: 10px; padding: 5px !important;");

    assert_eq!(transformer.declarations.len(), 3);
    assert_eq!(transformer.declarations[0], "background-color:red;");
    assert_eq!(transformer.declarations[1], "margin:10px;");
    assert_eq!(transformer.declarations[2], "padding:5px !important;");
  }

  #[test]
  fn test_whitespace_handling() {
    let (transformer, _) = parse_css("  background-color  :  red  ;  margin  :  10px  ;  ");

    assert_eq!(transformer.declarations.len(), 2);
    assert_eq!(transformer.declarations[0], "background-color:red;");
    assert_eq!(transformer.declarations[1], "margin:10px;");
  }

  #[test]
  fn test_missing_semicolon() {
    let (transformer, _) = parse_css("background-color: red");

    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(transformer.declarations[0], "background-color:red;");
  }

  #[test]
  fn test_bad_declarations() {
    // Invalid: missing colon
    let (transformer, _) = parse_css("background-color red;");
    assert_eq!(transformer.declarations.len(), 0);

    // Invalid: missing value
    let (transformer, _) = parse_css("background-color:;");
    assert_eq!(transformer.declarations.len(), 0);

    // Invalid: starting with non-ident
    let (transformer, _) = parse_css("123: red;");
    assert_eq!(transformer.declarations.len(), 0);
  }

  #[test]
  fn test_complex_values() {
    let (transformer, _) = parse_css("background: url(image.png) no-repeat center;");

    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.declarations[0],
      "background:url(image.png) no-repeat center;"
    );
  }

  #[test]
  fn test_empty_string() {
    let (transformer, _) = parse_css("");
    assert_eq!(transformer.declarations.len(), 0);
  }

  #[test]
  fn test_only_whitespace() {
    let (transformer, _) = parse_css("   \t\n  ");
    assert_eq!(transformer.declarations.len(), 0);
  }

  #[test]
  fn test_hyphenated_properties() {
    let (transformer, _) = parse_css("font-size: 14px; background-color: blue;");

    assert_eq!(transformer.declarations.len(), 2);
    assert_eq!(transformer.declarations[0], "font-size:14px;");
    assert_eq!(transformer.declarations[1], "background-color:blue;");
  }

  // Additional tests to improve coverage

  #[test]
  fn test_parser_edge_cases() {
    // Test consecutive semicolons
    let (transformer, _) = parse_css("background-color: red;;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(transformer.declarations[0], "background-color:red;");

    // Test missing value with semicolon
    let (transformer, _) = parse_css("background-color:;");
    assert_eq!(transformer.declarations.len(), 0);

    // Test bad declaration with brackets
    let (transformer, _) = parse_css("background-color: red{};");
    assert_eq!(transformer.declarations.len(), 0);

    // Test values with brackets
    let (transformer, _) = parse_css("background: url(test.png);");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(transformer.declarations[0], "background:url(test.png);");
  }

  #[test]
  fn test_important_edge_cases() {
    // Important with space before !
    let (transformer, _) = parse_css("background-color: red !important;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.declarations[0],
      "background-color:red !important;"
    );

    // Important with extra spaces - the parser includes the spaces in the value but doesn't recognize as important
    let (transformer, _) = parse_css("background-color: red ! important ;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.declarations[0],
      "background-color:red ! important;"
    );

    // Important without space - this actually does get recognized as important
    let (transformer, _) = parse_css("background-color: red!important;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.declarations[0],
      "background-color:red !important;"
    );

    // Debug: let's see what happens with extra content after !important
    let (transformer, _) = parse_css("background-color: red !important extra;");
    assert_eq!(transformer.declarations.len(), 1);
    // The parser actually includes extra content but still marks as important
    assert_eq!(
      transformer.declarations[0],
      "background-color:red  extra !important;"
    );
  }

  #[test]
  fn test_special_characters_and_escapes() {
    // Test escaped characters in property names
    // TODO: CSSProperty parser doesn't support escapes yet
    // let css = "\\62 order: red;"; // \62 = 'b', so this should be "border"
    // let (transformer, _) = parse_css(css);
    // assert_eq!(transformer.declarations.len(), 1);
    // assert_eq!(transformer.declarations[0], "border:red;");

    // Test unicode characters
    let (transformer, _) = parse_css("background-color: #fff;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(transformer.declarations[0], "background-color:#fff;");

    // Test with newlines
    let (transformer, _) = parse_css("background-color:\nred;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(transformer.declarations[0], "background-color:red;");
  }

  #[test]
  fn test_numeric_values() {
    // Test integer values
    let (transformer, _) = parse_css("z-index: 10;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(transformer.declarations[0], "z-index:10;");

    // Test decimal values
    let (transformer, _) = parse_css("opacity: 0.5;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(transformer.declarations[0], "opacity:0.5;");

    // Test negative values
    let (transformer, _) = parse_css("margin: -10px;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(transformer.declarations[0], "margin:-10px;");

    // Test percentage values
    let (transformer, _) = parse_css("width: 100%;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(transformer.declarations[0], "width:100%;");
  }

  #[test]
  fn test_string_values() {
    // Test quoted strings
    let (transformer, _) = parse_css("content: \"hello world\";");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(transformer.declarations[0], "content:\"hello world\";");

    // Test single quoted strings
    let (transformer, _) = parse_css("content: 'hello world';");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(transformer.declarations[0], "content:'hello world';");

    // Test strings with escapes
    let (transformer, _) = parse_css("content: \"hello\\\"world\";");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(transformer.declarations[0], "content:\"hello\\\"world\";");
  }

  #[test]
  fn test_url_values() {
    // Test unquoted URL
    let (transformer, _) = parse_css("background: url(test.png);");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(transformer.declarations[0], "background:url(test.png);");

    // Test quoted URL
    let (transformer, _) = parse_css("background: url(\"test.png\");");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(transformer.declarations[0], "background:url(\"test.png\");");

    // Test URL with spaces
    let (transformer, _) = parse_css("background: url( test.png );");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(transformer.declarations[0], "background:url( test.png );");
  }

  #[test]
  fn test_function_values() {
    // Test calc function
    let (transformer, _) = parse_css("width: calc(100% - 20px);");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(transformer.declarations[0], "width:calc(100% - 20px);");

    // Test rgb function
    let (transformer, _) = parse_css("background-color: rgb(255, 0, 0);");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.declarations[0],
      "background-color:rgb(255, 0, 0);"
    );

    // Test nested functions
    let (transformer, _) = parse_css("transform: translateX(calc(100% + 10px));");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.declarations[0],
      "transform:translateX(calc(100% + 10px));"
    );
  }

  #[test]
  fn test_comments() {
    // Test comments in values - these should be tokenized but ignored in parsing
    let (transformer, _) = parse_css("background-color: red /* comment */;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.declarations[0],
      "background-color:red /* comment */;"
    );

    // Test comment between declarations
    let (transformer, _) = parse_css("background-color: red; /* comment */ margin: 10px;");
    assert_eq!(transformer.declarations.len(), 2);
    assert_eq!(transformer.declarations[0], "background-color:red;");
    assert_eq!(transformer.declarations[1], "margin:10px;");
  }

  #[test]
  fn test_malformed_css() {
    // Test invalid characters
    let (transformer, _) = parse_css("background-color: red;; invalid: ;;");
    // This should parse "background-color: red" successfully, others may fail
    assert_eq!(transformer.declarations.len(), 1); // At least one valid declaration
    assert_eq!(transformer.declarations[0], "background-color:red;");
  }

  #[test]
  fn test_whitespace_variants() {
    // Test different whitespace characters
    let css = "background-color:\t\nred\r\n;";
    let (transformer, _) = parse_css(css);
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(transformer.declarations[0], "background-color:red;");

    // Test tabs and multiple spaces
    let (transformer, _) = parse_css("background-color:    \t\t   red   \t\t;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(transformer.declarations[0], "background-color:red;");
  }

  #[test]
  fn test_bom_handling() {
    // Test with Byte Order Mark
    let css_with_bom = "\u{FEFF}background-color: red;";
    let (transformer, _) = parse_css(css_with_bom);

    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(transformer.declarations[0], "background-color:red;");
  }
}
