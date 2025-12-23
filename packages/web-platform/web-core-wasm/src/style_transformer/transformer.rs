/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
#[cfg(feature = "client")]
use crate::css_tokenizer::tokenize;
use crate::css_tokenizer::{
  char_code_definitions::is_white_space, token_types::*, tokenize::Parser,
};
#[cfg_attr(test, derive(Debug, PartialEq))]
pub(crate) struct ParsedDeclaration {
  pub(crate) property_name: String,
  pub(crate) property_value: String,
  pub(crate) is_important: bool,
}

impl ParsedDeclaration {
  pub(crate) fn generate_to_string_buf(&self, string_buffer: &mut String) {
    string_buffer.push_str(&self.property_name);
    string_buffer.push(':');
    string_buffer.push_str(&self.property_value);
    if self.is_important {
      string_buffer.push_str(" !important");
    }
    string_buffer.push(';');
  }
}

use super::rules::query_transform_rules;

const IMPORTANT_STR: &str = "important";
pub struct StyleTransformer<'a, T: Generator> {
  generator: &'a mut T,

  status: usize,
  current_property: Option<String>,
  current_value: String,
  is_important: bool,
  prev_token_type: u8,
}

pub(crate) trait Generator {
  fn push_transformed_style(&mut self, declaration: ParsedDeclaration);
  fn push_transform_kids_style(&mut self, declaration: ParsedDeclaration);
}

impl<'a, T: Generator> Parser for StyleTransformer<'a, T> {
  fn on_token(&mut self, token_type: u8, token_value: &str) {
    let (token_type, token_value) =
      super::token_transformer::transform_one_token(token_type, token_value);
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
      self.current_property = Some(token_value.to_string());
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
        self.current_property.is_some(),
        "property name should be set before semicolon"
      );
      let property_name = self.current_property.take().unwrap();
      // create a string with buf size 8 chars
      let property_value = std::mem::replace(&mut self.current_value, String::with_capacity(8));
      self.status = 0; // reset
      self.on_declaration_parsed(ParsedDeclaration {
        property_name,
        property_value,
        is_important: self.is_important,
      });
      self.is_important = false;
    } else if self.status == 3
      && self.prev_token_type == DELIM_TOKEN
      && token_value.eq_ignore_ascii_case(IMPORTANT_STR)
    {
      // here we will have some bad caes: like
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
      self.current_property = None;
      self.current_value = String::with_capacity(8);
      self.is_important = false;
    }
    self.prev_token_type = token_type;
  }
}
impl<'a, T: Generator> StyleTransformer<'a, T> {
  pub(crate) fn new(generator: &'a mut T) -> Self {
    StyleTransformer {
      generator,
      status: 0,
      current_property: None,
      current_value: String::with_capacity(8),
      is_important: false,
      prev_token_type: WHITESPACE_TOKEN, // start with whitespace
    }
  }

  #[cfg(any(feature = "client", test))]
  pub(crate) fn parse(&mut self, source: &str) {
    tokenize::tokenize(source, self);
    if self.prev_token_type != SEMICOLON_TOKEN {
      self.on_token(SEMICOLON_TOKEN, ";");
    }
  }

  fn on_declaration_parsed(&mut self, declaration: ParsedDeclaration) {
    let empty: bool = {
      let (current_declarations, kids_declarations) =
        query_transform_rules(&declaration.property_name, &declaration.property_value);
      for (name, value) in kids_declarations.into_iter() {
        self.generator.push_transform_kids_style(ParsedDeclaration {
          property_name: name.to_string(),
          property_value: value.to_string(),
          is_important: declaration.is_important,
        });
      }
      if current_declarations.is_empty() {
        true
      } else {
        for (name, value) in current_declarations.into_iter() {
          self.generator.push_transformed_style(ParsedDeclaration {
            property_name: name.to_string(),
            property_value: value.to_string(),
            is_important: declaration.is_important,
          });
        }
        false
      }
    };
    if empty {
      self.generator.push_transformed_style(declaration);
    }
  }
}

#[cfg(test)]
mod tests {
  use super::Generator;
  use super::ParsedDeclaration;

  struct TestTransformer {
    pub declarations: Vec<ParsedDeclaration>,
  }

  impl TestTransformer {
    fn get_name<'a>(&self, _source: &'a str, decl: &'a ParsedDeclaration) -> &'a str {
      &decl.property_name
    }

    fn get_value<'a>(&self, _source: &'a str, decl: &'a ParsedDeclaration) -> &'a str {
      &decl.property_value
    }
  }
  impl Generator for TestTransformer {
    fn push_transform_kids_style(&mut self, _decl: ParsedDeclaration) {
      // TestTransformer does not need to handle kids styles
    }
    fn push_transformed_style(&mut self, decl: ParsedDeclaration) {
      self.declarations.push(decl);
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
    let (transformer, source) = parse_css("background-color: red;");

    assert_eq!(transformer.declarations.len(), 1);
    let decl = &transformer.declarations[0];
    assert_eq!(transformer.get_name(source, decl), "background-color");
    assert_eq!(transformer.get_value(source, decl), "red");
    assert!(!decl.is_important);
  }

  #[test]
  fn test_important_declaration() {
    let (transformer, source) = parse_css("background-color: red !important;");

    assert_eq!(transformer.declarations.len(), 1);
    let decl = &transformer.declarations[0];
    assert_eq!(transformer.get_name(source, decl), "background-color");
    assert_eq!(transformer.get_value(source, decl), "red");
    assert!(decl.is_important);
  }

  #[test]
  fn test_multiple_declarations() {
    let (transformer, source) =
      parse_css("background-color: red; margin: 10px; padding: 5px !important;");

    assert_eq!(transformer.declarations.len(), 3);

    assert_eq!(
      transformer.get_name(source, &transformer.declarations[0]),
      "background-color"
    );
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "red"
    );
    assert!(!transformer.declarations[0].is_important);

    assert_eq!(
      transformer.get_name(source, &transformer.declarations[1]),
      "margin"
    );
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[1]),
      "10px"
    );
    assert!(!transformer.declarations[1].is_important);

    assert_eq!(
      transformer.get_name(source, &transformer.declarations[2]),
      "padding"
    );
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[2]),
      "5px"
    );
    assert!(transformer.declarations[2].is_important);
  }

  #[test]
  fn test_whitespace_handling() {
    let (transformer, source) = parse_css("  background-color  :  red  ;  margin  :  10px  ;  ");

    assert_eq!(transformer.declarations.len(), 2);
    assert_eq!(
      transformer.get_name(source, &transformer.declarations[0]),
      "background-color"
    );
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "red"
    );
    assert_eq!(
      transformer.get_name(source, &transformer.declarations[1]),
      "margin"
    );
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[1]),
      "10px"
    );
  }

  #[test]
  fn test_missing_semicolon() {
    let (transformer, source) = parse_css("background-color: red");

    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_name(source, &transformer.declarations[0]),
      "background-color"
    );
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "red"
    );
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
    let (transformer, source) = parse_css("background: url(image.png) no-repeat center;");

    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_name(source, &transformer.declarations[0]),
      "background"
    );
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "url(image.png) no-repeat center"
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
    let (transformer, source) = parse_css("font-size: 14px; background-color: blue;");

    assert_eq!(transformer.declarations.len(), 2);
    assert_eq!(
      transformer.get_name(source, &transformer.declarations[0]),
      "font-size"
    );
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "14px"
    );
    assert_eq!(
      transformer.get_name(source, &transformer.declarations[1]),
      "background-color"
    );
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[1]),
      "blue"
    );
  }

  // Additional tests to improve coverage

  #[test]
  fn test_parser_edge_cases() {
    // Test consecutive semicolons
    let (transformer, _) = parse_css("background-color: red;;");
    assert_eq!(transformer.declarations.len(), 1);

    // Test missing value with semicolon
    let (transformer, _) = parse_css("background-color:;");
    assert_eq!(transformer.declarations.len(), 0);

    // Test bad declaration with brackets
    let (transformer, _) = parse_css("background-color: red{};");
    assert_eq!(transformer.declarations.len(), 0);

    // Test values with brackets
    let (transformer, source) = parse_css("background: url(test.png);");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "url(test.png)"
    );
  }

  #[test]
  fn test_important_edge_cases() {
    // Important with space before !
    let (transformer, source) = parse_css("background-color: red !important;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "red"
    );
    assert!(transformer.declarations[0].is_important);

    // Important with extra spaces - the parser includes the spaces in the value but doesn't recognize as important
    let (transformer, source) = parse_css("background-color: red ! important ;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "red ! important"
    );
    assert!(!transformer.declarations[0].is_important); // Extra space breaks the important detection

    // Important without space - this actually does get recognized as important
    let (transformer, source) = parse_css("background-color: red!important;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "red"
    );
    assert!(transformer.declarations[0].is_important); // Actually recognized as important

    // Debug: let's see what happens with extra content after !important
    let (transformer, source) = parse_css("background-color: red !important extra;");
    assert_eq!(transformer.declarations.len(), 1);
    // The parser actually includes extra content but still marks as important
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "red  extra"
    );
    assert!(transformer.declarations[0].is_important);
  }

  #[test]
  fn test_special_characters_and_escapes() {
    // Test escaped characters in property names
    let css = "\\62 order: red;"; // \62 = 'b', so this should be "border"
    let (transformer, _source) = parse_css(css);
    assert_eq!(transformer.declarations.len(), 1);

    // Test unicode characters
    let (transformer, source) = parse_css("background-color: #fff;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "#fff"
    );

    // Test with newlines
    let (transformer, source) = parse_css("background-color:\nred;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "red"
    );
  }

  #[test]
  fn test_numeric_values() {
    // Test integer values
    let (transformer, source) = parse_css("z-index: 10;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "10"
    );

    // Test decimal values
    let (transformer, source) = parse_css("opacity: 0.5;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "0.5"
    );

    // Test negative values
    let (transformer, source) = parse_css("margin: -10px;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "-10px"
    );

    // Test percentage values
    let (transformer, source) = parse_css("width: 100%;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "100%"
    );
  }

  #[test]
  fn test_string_values() {
    // Test quoted strings
    let (transformer, source) = parse_css("content: \"hello world\";");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "\"hello world\""
    );

    // Test single quoted strings
    let (transformer, source) = parse_css("content: 'hello world';");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "'hello world'"
    );

    // Test strings with escapes
    let (transformer, _source) = parse_css("content: \"hello\\\"world\";");
    assert_eq!(transformer.declarations.len(), 1);
  }

  #[test]
  fn test_url_values() {
    // Test unquoted URL
    let (transformer, source) = parse_css("background: url(test.png);");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "url(test.png)"
    );

    // Test quoted URL
    let (transformer, source) = parse_css("background: url(\"test.png\");");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "url(\"test.png\")"
    );

    // Test URL with spaces
    let (transformer, source) = parse_css("background: url( test.png );");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "url( test.png )"
    );
  }

  #[test]
  fn test_function_values() {
    // Test calc function
    let (transformer, source) = parse_css("width: calc(100% - 20px);");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "calc(100% - 20px)"
    );

    // Test rgb function
    let (transformer, source) = parse_css("background-color: rgb(255, 0, 0);");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "rgb(255, 0, 0)"
    );

    // Test nested functions
    let (transformer, source) = parse_css("transform: translateX(calc(100% + 10px));");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "translateX(calc(100% + 10px))"
    );
  }

  #[test]
  fn test_comments() {
    // Test comments in values - these should be tokenized but ignored in parsing
    let (transformer, source) = parse_css("background-color: red /* comment */;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "red /* comment */"
    );

    // Test comment between declarations
    let (transformer, source) = parse_css("background-color: red; /* comment */ margin: 10px;");
    assert_eq!(transformer.declarations.len(), 2);
    assert_eq!(
      transformer.get_name(source, &transformer.declarations[0]),
      "background-color"
    );
    assert_eq!(
      transformer.get_name(source, &transformer.declarations[1]),
      "margin"
    );
  }

  #[test]
  fn test_malformed_css() {
    // Test invalid characters
    let (transformer, _) = parse_css("background-color: red;; invalid: ;;");
    // This should parse "background-color: red" successfully, others may fail
    assert_eq!(transformer.declarations.len(), 1); // At least one valid declaration
  }

  #[test]
  fn test_whitespace_variants() {
    // Test different whitespace characters
    let css = "background-color:\t\nred\r\n;";
    let (transformer, source) = parse_css(css);
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "red"
    );

    // Test tabs and multiple spaces
    let (transformer, source) = parse_css("background-color:    \t\t   red   \t\t;");
    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "red"
    );
  }

  #[test]
  fn test_bom_handling() {
    // Test with Byte Order Mark
    let css_with_bom = "\u{FEFF}background-color: red;";
    let (transformer, source) = parse_css(css_with_bom);

    assert_eq!(transformer.declarations.len(), 1);
    assert_eq!(
      transformer.get_name(source, &transformer.declarations[0]),
      "background-color"
    );
    assert_eq!(
      transformer.get_value(source, &transformer.declarations[0]),
      "red"
    );
  }
}
