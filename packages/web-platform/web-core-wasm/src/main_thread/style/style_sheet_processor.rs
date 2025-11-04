use super::transformer::transform;
use crate::constants;
use crate::template::{FlattenedStyleInfo, Selector};
use std::borrow::Cow;
use std::collections::HashMap;

fn generate_css_selector_by_css_id<'a>(
  css_id: i32,
  selector: &'a Selector,
  enable_remove_css_scope: bool,
  entry_name: Option<&'a str>,
) -> Vec<Cow<'a, str>> {
  let mut string_buffer: Vec<Cow<'_, str>> = Vec::new();
  let suffix: String = {
    let mut suffix_buffer: Vec<String> = Vec::new();
    if !enable_remove_css_scope {
      suffix_buffer.push(format!("[{}=\"{}\"]", constants::CSS_ID_ATTRIBUTE, css_id));
    } else {
      suffix_buffer.push(format!("[{}]", constants::LYNX_TAG_ATTRIBUTE));
    }
    if let Some(entry_name) = entry_name {
      suffix_buffer.push(format!(
        "[{}=\"{}\"]",
        constants::LYNX_ENTRY_NAME_ATTRIBUTE,
        entry_name
      ));
    } else {
      suffix_buffer.push(format!(":not([{}])", constants::LYNX_ENTRY_NAME_ATTRIBUTE));
    }
    suffix_buffer.join("")
  };
  for index in 0..selector.len() {
    let (plain_selector, pseudo_classes, pseudo_element, combinator_selector) = &selector[index];
    string_buffer.extend(plain_selector.iter().map(|s| Cow::Borrowed(s.as_str())));
    if index == selector.len() - 1 {
      // the last one
      string_buffer.push(Cow::Owned(suffix.clone()));
    }
    string_buffer.extend(pseudo_classes.iter().map(|s| Cow::Borrowed(s.as_str())));
    string_buffer.extend(pseudo_element.iter().map(|s| Cow::Borrowed(s.as_str())));
    string_buffer.extend(
      combinator_selector
        .iter()
        .map(|s| Cow::Borrowed(s.as_str())),
    );
  }
  string_buffer
}

fn generate_selectors_to_buffer<'a>(
  css_content_buffer: &mut Vec<Cow<'a, str>>,
  selector_strings: &Vec<Vec<Cow<'a, str>>>,
  append_children_combinator: bool,
) {
  let mut selector_strings_iter = selector_strings.iter().peekable();
  while let Some(selector_string) = selector_strings_iter.next() {
    css_content_buffer.extend(selector_string.iter().cloned());
    if append_children_combinator {
      css_content_buffer.push(Cow::Borrowed(" > *"));
    }
    if selector_strings_iter.peek().is_some() {
      css_content_buffer.push(Cow::Borrowed(","));
    }
  }
}

fn generate_declarations_to_buffer<'a>(
  css_content_buffer: &mut Vec<Cow<'a, str>>,
  declarations: &Vec<(&'a str, &'a str)>,
) {
  css_content_buffer.push(Cow::Borrowed("{"));
  for (prop, value) in declarations {
    css_content_buffer.push(Cow::Borrowed(prop));
    css_content_buffer.push(Cow::Borrowed(":"));
    css_content_buffer.push(Cow::Borrowed(value));
    css_content_buffer.push(Cow::Borrowed(";"));
  }
  css_content_buffer.push(Cow::Borrowed("}"));
}

fn transform_declarations(
  declarations: &Vec<(String, String)>,
) -> (Vec<(&str, &str)>, Vec<(&str, &str)>) {
  let mut new_declarations: Vec<(&str, &str)> = Vec::new();
  let mut children_declarations: Vec<(&str, &str)> = Vec::new();
  for (prop, value) in declarations.iter() {
    let (current_declarations, children_combinator_declarations) =
      transform::query_transform_rules(prop, value);
    if current_declarations.is_empty() {
      new_declarations.push((prop, value));
    } else {
      new_declarations.extend(current_declarations);
    }
    children_declarations.extend(children_combinator_declarations);
  }
  (new_declarations, children_declarations)
}

pub fn transform_to_web_style_css_ng(
  flattened_style_info: &FlattenedStyleInfo,
  enable_remove_css_scope: bool,
  entry_name: Option<&str>,
) -> String {
  let mut css_content_buffer: Vec<Cow<'_, str>> = Vec::new();
  for style_sheet in flattened_style_info.iter() {
    css_content_buffer.push(Cow::Borrowed(style_sheet.at_rules.as_str()));
    for style_rule in style_sheet.rules.iter() {
      let transformed_selector_strings: Vec<Vec<Cow<'_, str>>> = style_sheet
        .imported_by
        .iter()
        .flat_map(|css_id| {
          style_rule.selectors.iter().map(|selector| {
            generate_css_selector_by_css_id(*css_id, selector, enable_remove_css_scope, entry_name)
          })
        })
        .collect();

      let (new_declarations, children_combinator_rule_declarations) =
        transform_declarations(&style_rule.declarations);

      // Generate the main rule
      generate_selectors_to_buffer(
        &mut css_content_buffer,
        &transformed_selector_strings,
        false,
      );
      generate_declarations_to_buffer(&mut css_content_buffer, &new_declarations);

      // Generate the children combinator rule if needed
      if !children_combinator_rule_declarations.is_empty() {
        generate_selectors_to_buffer(&mut css_content_buffer, &transformed_selector_strings, true);
        generate_declarations_to_buffer(
          &mut css_content_buffer,
          &children_combinator_rule_declarations,
        );
      }
    }
  }
  css_content_buffer.join("")
}

pub(super) type CssOgCssIdToClassNameToDeclarationsMap =
  HashMap<i32, HashMap<String, HashMap<String, String>>>;
/**
 * For Old generation css system
 * The css OG is different from the new generation css system
 * It has different behaviors from the standard W3C CSS
 * Here is our design:
 * We will generate a Map and a css string
 * The Map is used to query those rules with only one class selector, using css_id, class_name to get the transformed declarations
 * The css string is used to cover all the other complex selectors
 * This function will return both the css string and the Map
 */
pub fn transform_to_web_style_css_og(
  flattened_style_info: &FlattenedStyleInfo,
  enable_remove_css_scope: bool,
  entry_name: Option<&str>,
) -> (String, CssOgCssIdToClassNameToDeclarationsMap) {
  let mut css_content_buffer: Vec<Cow<'_, str>> = Vec::new();
  let mut css_og_style_resolve_map: CssOgCssIdToClassNameToDeclarationsMap = HashMap::new();
  for style_sheet in flattened_style_info.iter() {
    css_content_buffer.push(Cow::Borrowed(style_sheet.at_rules.as_str()));
    for style_rule in style_sheet.rules.iter() {
      let (simple_selectors, complex_selectors): (Vec<_>, Vec<_>) =
        style_rule.selectors.iter().partition(|selector| {
          // simple selector: only one plain selector, no pseudo-classes, no pseudo-elements, no combinator selectors
          selector.len() == 1
            && selector[0].0.len() == 1
            && selector[0].1.is_empty()
            && selector[0].2.is_empty()
            && selector[0].3.is_empty()
        });
      let (new_declarations, children_combinator_rule_declarations) =
        transform_declarations(&style_rule.declarations);
      let mut transformed_complex_selector_strings: Vec<Vec<Cow<'_, str>>> = Vec::new();
      let mut transformed_simple_selector_strings: Vec<Vec<Cow<'_, str>>> = Vec::new();

      for css_id in style_sheet.imported_by.iter() {
        // Process simple selectors
        for &selector in &simple_selectors {
          let plain_selector = &selector[0].0[0];
          // Only simple selectors are stored in the map
          css_og_style_resolve_map
            .entry(*css_id)
            .or_default()
            .entry(plain_selector.clone())
            .or_default()
            .extend(
              new_declarations
                .iter()
                .map(|(p, v)| (p.to_string(), v.to_string())),
            );
          // If there are children combinator declarations, we also need to generate a CSS rule for the simple selector
          if !children_combinator_rule_declarations.is_empty() {
            transformed_simple_selector_strings.push(generate_css_selector_by_css_id(
              *css_id,
              selector,
              enable_remove_css_scope,
              entry_name,
            ));
          }
        }
        // Process complex selectors
        for &selector in &complex_selectors {
          transformed_complex_selector_strings.push(generate_css_selector_by_css_id(
            *css_id,
            selector,
            enable_remove_css_scope,
            entry_name,
          ));
        }
      }

      // Generate CSS rules for complex selectors with their declarations
      if !transformed_complex_selector_strings.is_empty() {
        generate_selectors_to_buffer(
          &mut css_content_buffer,
          &transformed_complex_selector_strings,
          false,
        );
        generate_declarations_to_buffer(&mut css_content_buffer, &new_declarations);
      }

      // Generate CSS rules for children combinators if they exist
      if !children_combinator_rule_declarations.is_empty() {
        // These rules apply to both simple and complex selectors
        let all_selectors = transformed_simple_selector_strings
          .iter()
          .chain(transformed_complex_selector_strings.iter())
          .cloned()
          .collect();
        generate_selectors_to_buffer(&mut css_content_buffer, &all_selectors, true);
        generate_declarations_to_buffer(
          &mut css_content_buffer,
          &children_combinator_rule_declarations,
        );
      }
    }
  }
  (css_content_buffer.join(""), css_og_style_resolve_map)
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::template::{FlattenedStyleSheet, StyleRule};
  use std::collections::HashMap;

  #[test]
  fn test_generate_css_selector_by_css_id() {
    let selector: Selector = vec![(
      vec!["div".to_string()],
      vec![":hover".to_string()],
      vec![],
      vec![],
    )];

    // Case 1: enable_remove_css_scope = false, entry_name = None
    let result1 = generate_css_selector_by_css_id(1, &selector, false, None);
    assert_eq!(
      result1.join(""),
      "div[l-css-id=\"1\"]:not([l-e-name]):hover"
    );

    // Case 2: enable_remove_css_scope = true, entry_name = None
    let result2 = generate_css_selector_by_css_id(1, &selector, true, None);
    assert_eq!(result2.join(""), "div[lynx-tag]:not([l-e-name]):hover");

    // Case 3: enable_remove_css_scope = false, entry_name = Some("app")
    let result3 = generate_css_selector_by_css_id(1, &selector, false, Some("app"));
    assert_eq!(
      result3.join(""),
      "div[l-css-id=\"1\"][l-e-name=\"app\"]:hover"
    );

    // Case 4: Complex selector
    let complex_selector: Selector = vec![
      (
        vec!["div".to_string()],
        vec![],
        vec![],
        vec![" > ".to_string()],
      ),
      (
        vec!["span".to_string()],
        vec![":focus".to_string()],
        vec![],
        vec![],
      ),
    ];
    let result4 = generate_css_selector_by_css_id(2, &complex_selector, false, None);
    assert_eq!(
      result4.join(""),
      "div > span[l-css-id=\"2\"]:not([l-e-name]):focus"
    );
  }

  #[test]
  fn test_transform_to_web_style_css_ng_simple() {
    let rule = StyleRule {
      selectors: vec![vec![(
        vec!["div".to_string()],
        vec![":hover".to_string()],
        vec![],
        vec![],
      )]],
      declarations: vec![("background-color".to_string(), "red".to_string())],
    };
    let flattened_style_info: FlattenedStyleInfo = vec![FlattenedStyleSheet {
      rules: vec![rule],
      at_rules: "".to_string(),
      imported_by: vec![1],
    }];

    let css = transform_to_web_style_css_ng(&flattened_style_info, false, None);
    assert_eq!(
      css,
      "div[l-css-id=\"1\"]:not([l-e-name]):hover{background-color:red;}"
    );
  }

  #[test]
  fn test_transform_to_web_style_css_ng_with_at_rules() {
    let flattened_style_info: FlattenedStyleInfo = vec![FlattenedStyleSheet {
      rules: vec![],
      at_rules: "@media screen { div { color: blue; } }".to_string(),
      imported_by: vec![1],
    }];

    let css = transform_to_web_style_css_ng(&flattened_style_info, false, None);
    assert_eq!(css, "@media screen { div { color: blue; } }");
  }

  #[test]
  fn test_transform_to_web_style_css_ng_with_imports() {
    let rule = StyleRule {
      selectors: vec![vec![(vec!["p".to_string()], vec![], vec![], vec![])]],
      declarations: vec![("font-size".to_string(), "14px".to_string())],
    };
    let flattened_style_info: FlattenedStyleInfo = vec![FlattenedStyleSheet {
      rules: vec![rule],
      at_rules: "".to_string(),
      imported_by: vec![1, 2],
    }];

    let css = transform_to_web_style_css_ng(&flattened_style_info, false, Some("test-app"));
    assert_eq!(
      css,
      "p[l-css-id=\"1\"][l-e-name=\"test-app\"],p[l-css-id=\"2\"][l-e-name=\"test-app\"]{font-size:14px;}"
    );
  }

  #[test]
  fn test_transform_to_web_style_css_ng_with_children_combinator() {
    let rule = StyleRule {
      selectors: vec![vec![(vec!["div".to_string()], vec![], vec![], vec![])]],
      declarations: vec![("linear-weight-sum".to_string(), "2".to_string())],
    };
    let flattened_style_info: FlattenedStyleInfo = vec![FlattenedStyleSheet {
      rules: vec![rule],
      at_rules: "".to_string(),
      imported_by: vec![1],
    }];

    let css = transform_to_web_style_css_ng(&flattened_style_info, true, None);
    assert!(css.contains("div[lynx-tag]:not([l-e-name]) > *{--lynx-linear-weight-sum:2;}"));
  }

  #[test]
  fn test_transform_to_web_style_css_og_simple_selector() {
    let rule = StyleRule {
      selectors: vec![vec![(vec![".simple".to_string()], vec![], vec![], vec![])]],
      declarations: vec![("background-color".to_string(), "red".to_string())],
    };
    let flattened_style_info: FlattenedStyleInfo = vec![FlattenedStyleSheet {
      rules: vec![rule],
      at_rules: "".to_string(),
      imported_by: vec![1],
    }];

    let (css, map) = transform_to_web_style_css_og(&flattened_style_info, false, None);

    // The simple selector rule should not be in the CSS string
    assert_eq!(css, "");

    // It should be in the map
    assert_eq!(map.len(), 1);
    let style_map = map.get(&1).unwrap();
    assert_eq!(style_map.len(), 1);
    let declarations = style_map.get(".simple").unwrap();
    let expected_declarations: HashMap<String, String> =
      [("background-color".to_string(), "red".to_string())]
        .iter()
        .cloned()
        .collect();
    assert_eq!(declarations, &expected_declarations);
  }

  #[test]
  fn test_transform_to_web_style_css_og_complex_selector() {
    let rule = StyleRule {
      selectors: vec![vec![(
        vec![".complex".to_string()],
        vec![":hover".to_string()],
        vec![],
        vec![],
      )]],
      declarations: vec![("background-color".to_string(), "blue".to_string())],
    };
    let flattened_style_info: FlattenedStyleInfo = vec![FlattenedStyleSheet {
      rules: vec![rule],
      at_rules: "".to_string(),
      imported_by: vec![1],
    }];

    let (css, map) = transform_to_web_style_css_og(&flattened_style_info, false, None);

    // The complex selector rule should be in the CSS string
    assert_eq!(
      css,
      ".complex[l-css-id=\"1\"]:not([l-e-name]):hover{background-color:blue;}"
    );

    // The map should be empty
    assert!(map.is_empty());
  }

  #[test]
  fn test_transform_to_web_style_css_og_mixed_selectors() {
    let rule = StyleRule {
      selectors: vec![
        vec![(vec![".simple".to_string()], vec![], vec![], vec![])],
        vec![(
          vec![".complex".to_string()],
          vec![":hover".to_string()],
          vec![],
          vec![],
        )],
      ],
      declarations: vec![("background-color".to_string(), "green".to_string())],
    };
    let flattened_style_info: FlattenedStyleInfo = vec![FlattenedStyleSheet {
      rules: vec![rule],
      at_rules: "".to_string(),
      imported_by: vec![1],
    }];

    let (css, map) = transform_to_web_style_css_og(&flattened_style_info, false, None);

    // The complex selector rule should be in the CSS string
    assert_eq!(
      css,
      ".complex[l-css-id=\"1\"]:not([l-e-name]):hover{background-color:green;}"
    );
    // The simple selector should be in the map
    assert_eq!(map.len(), 1);
    let style_map = map.get(&1).unwrap();
    assert_eq!(style_map.len(), 1);
    let declarations = style_map.get(".simple").unwrap();
    let expected_declarations: HashMap<String, String> =
      [("background-color".to_string(), "green".to_string())]
        .iter()
        .cloned()
        .collect();
    assert_eq!(declarations, &expected_declarations);
  }

  #[test]
  fn test_transform_to_web_style_css_og_with_children_combinator() {
    let rule = StyleRule {
      selectors: vec![
        vec![(vec![".simple".to_string()], vec![], vec![], vec![])],
        vec![(
          vec![".complex".to_string()],
          vec![":hover".to_string()],
          vec![],
          vec![],
        )],
      ],
      declarations: vec![("linear-weight-sum".to_string(), "3".to_string())],
    };
    let flattened_style_info: FlattenedStyleInfo = vec![FlattenedStyleSheet {
      rules: vec![rule],
      at_rules: "".to_string(),
      imported_by: vec![1],
    }];

    let (css, map) = transform_to_web_style_css_og(&flattened_style_info, true, None);

    // The map should be populated with the simple selector and its transformed declarations
    assert_eq!(map.len(), 1);
    let style_map = map.get(&1).unwrap();
    assert_eq!(style_map.len(), 1);

    // The CSS string should contain the rule for the complex selector
    assert!(
      css.contains(".complex[lynx-tag]:not([l-e-name]):hover > *{--lynx-linear-weight-sum:3;}")
    );
    // It should also contain the children combinator rule for BOTH simple and complex selectors
    assert!(css.contains(".simple[lynx-tag]:not([l-e-name]) > *,.complex[lynx-tag]:not([l-e-name]):hover > *{--lynx-linear-weight-sum:3;}"));
  }

  #[test]
  fn test_transform_to_web_style_css_og_with_at_rules_and_imports() {
    let simple_rule = StyleRule {
      selectors: vec![vec![(vec![".simple".to_string()], vec![], vec![], vec![])]],
      declarations: vec![("background-color".to_string(), "red".to_string())],
    };
    let complex_rule = StyleRule {
      selectors: vec![vec![(
        vec!["div".to_string()],
        vec![":hover".to_string()],
        vec![],
        vec![],
      )]],
      declarations: vec![("font-size".to_string(), "20px".to_string())],
    };

    let flattened_style_info: FlattenedStyleInfo = vec![
      FlattenedStyleSheet {
        rules: vec![simple_rule],
        at_rules: "@media (min-width: 600px)".to_string(),
        imported_by: vec![1, 2], // Imported by two components
      },
      FlattenedStyleSheet {
        rules: vec![complex_rule],
        at_rules: "".to_string(),
        imported_by: vec![3],
      },
    ];

    let (css, map) = transform_to_web_style_css_og(&flattened_style_info, false, Some("my-app"));

    // Check the map for simple selectors from both importing components
    assert_eq!(map.len(), 2);
    let expected_declarations: HashMap<String, String> =
      [("background-color".to_string(), "red".to_string())]
        .iter()
        .cloned()
        .collect();
    let style_map_1 = map.get(&1).unwrap();
    assert_eq!(style_map_1.get(".simple").unwrap(), &expected_declarations);
    let style_map_2 = map.get(&2).unwrap();
    assert_eq!(style_map_2.get(".simple").unwrap(), &expected_declarations);
    assert!(!map.contains_key(&3)); // No simple selectors for css_id 3

    // Check the CSS string for at-rules and complex selectors
    let expected_css =
      "@media (min-width: 600px)div[l-css-id=\"3\"][l-e-name=\"my-app\"]:hover{font-size:20px;}";
    assert_eq!(css, expected_css);
  }
}
