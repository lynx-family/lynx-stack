use crate::template::template_loader::{Selector, StyleInfo, StyleRule};
use crate::{constants, style::transformer::transform};
use std::borrow::Cow;
use std::collections::{HashMap, HashSet};

pub struct FlattenedStyleSheet {
  pub rules: Vec<StyleRule>,
  pub at_rules: String,
  pub imported_by: Vec<i32>,
}

/**
 * value: FlattenedStyleSheet
 */
pub type FlattenedStyleInfo = Vec<FlattenedStyleSheet>;

/**
 * get Transitive Closure of a Direct Acyclic Graph (DAG)
 * 1. for each css, find all the imported by css files (directly and indirectly)
 * 2. for each css, find all the importing css files (directly and indirectly)
 * 3. return the flattened style info, do not modify the content and rules
 */
pub fn flatten_style_info(mut style_info: StyleInfo) -> FlattenedStyleInfo {
  // Step 1. Topological sorting
  /*
   * kahn's algorithm
   * 1. The styleInfo is already equivalent to a adjacency list. (cssId, import)
   * 2. The styleInfo is a DAG therefore we don't need to do cyclic detection
   */
  let mut in_degree_map: HashMap<i32, i32> = HashMap::new();
  let mut sorted_css_ids: Vec<i32> = Vec::new();
  let mut imported_by_map: HashMap<i32, HashSet<i32>> = HashMap::new();
  let mut flattened_style_info: FlattenedStyleInfo = Vec::new();

  for (css_id, style_sheet) in style_info.iter() {
    in_degree_map.entry(*css_id).or_insert(0);
    for imported_css_id in style_sheet.imports.iter() {
      let in_degree = in_degree_map.entry(*imported_css_id).or_insert(0);
      *in_degree += 1;
    }
  }

  // Initialize the queue with nodes having in-in_degree of 0
  for (css_id, in_degree) in in_degree_map.iter() {
    if *in_degree == 0 {
      sorted_css_ids.push(*css_id);
    }
  }

  let mut index = 0;
  // Process the queue in place
  while index < sorted_css_ids.len() {
    let css_id = sorted_css_ids[index];
    index += 1;
    // Decrease the in-in_degree of all imported CSS files
    for imported_css_id in style_info[&css_id].imports.iter() {
      let in_degree = in_degree_map.entry(*imported_css_id).or_insert(1);
      *in_degree -= 1;
      if *in_degree == 0 {
        sorted_css_ids.push(*imported_css_id);
      }
    }
  }

  // Step 2. generate deps;
  for css_id in sorted_css_ids.iter() {
    let style_sheet = &style_info[css_id];
    // mark it is imported by itself
    imported_by_map.entry(*css_id).or_default().insert(*css_id);
    let current_css_id_imported_by = imported_by_map.get(css_id).unwrap().clone();
    for importing_css_id in style_sheet.imports.iter() {
      let importing_css_id_imported_by = imported_by_map.entry(*importing_css_id).or_default();
      importing_css_id_imported_by.extend(current_css_id_imported_by.iter().cloned());
    }
  }

  // Step 3. generate flattened style info
  for css_id in sorted_css_ids.iter() {
    let style_sheet = style_info.remove(css_id).unwrap();
    let imported_by_set = imported_by_map.get(css_id).unwrap();
    let imported_by: Vec<i32> = imported_by_set.iter().cloned().collect();
    let flattened_style_sheet = FlattenedStyleSheet {
      rules: style_sheet.rules,
      at_rules: style_sheet.at_rules,
      imported_by,
    };
    flattened_style_info.push(flattened_style_sheet);
  }

  flattened_style_info
}

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
) -> (
  String,
  HashMap<i32, HashMap<String, HashMap<String, String>>>,
) {
  let mut css_content_buffer: Vec<Cow<'_, str>> = Vec::new();
  let mut css_og_style_resolve_map: HashMap<i32, HashMap<String, HashMap<String, String>>> =
    HashMap::new();
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
  use crate::template::template_loader::StyleSheet;
  use std::collections::{HashMap, HashSet};

  #[test]
  fn test_flatten_style_info() {
    let mut style_info: StyleInfo = HashMap::new();
    style_info.insert(
      1,
      StyleSheet {
        rules: vec![],
        at_rules: String::new(),
        imports: vec![2],
      },
    );
    style_info.insert(
      2,
      StyleSheet {
        rules: vec![],
        at_rules: String::new(),
        imports: vec![3],
      },
    );
    style_info.insert(
      3,
      StyleSheet {
        rules: vec![],
        at_rules: String::new(),
        imports: vec![],
      },
    );

    let flattened_info = flatten_style_info(style_info);

    // Since the output is a Vec, we need to find the items.
    // The order is not guaranteed, so we'll check for existence and properties.
    assert_eq!(flattened_info.len(), 3);

    let sheet1 = flattened_info
      .iter()
      .find(|s| s.imported_by.contains(&1) && s.imported_by.len() == 1)
      .unwrap();
    let sheet2 = flattened_info
      .iter()
      .find(|s| s.imported_by.contains(&2) && s.imported_by.len() == 2)
      .unwrap();
    let sheet3 = flattened_info
      .iter()
      .find(|s| s.imported_by.contains(&3) && s.imported_by.len() == 3)
      .unwrap();

    let imported_by_1: HashSet<i32> = sheet1.imported_by.iter().cloned().collect();
    let imported_by_2: HashSet<i32> = sheet2.imported_by.iter().cloned().collect();
    let imported_by_3: HashSet<i32> = sheet3.imported_by.iter().cloned().collect();

    let expected_imported_by_1: HashSet<i32> = [1].iter().cloned().collect();
    let expected_imported_by_2: HashSet<i32> = [1, 2].iter().cloned().collect();
    let expected_imported_by_3: HashSet<i32> = [1, 2, 3].iter().cloned().collect();

    assert_eq!(imported_by_1, expected_imported_by_1);
    assert_eq!(imported_by_2, expected_imported_by_2);
    assert_eq!(imported_by_3, expected_imported_by_3);
  }

  #[test]
  fn test_flatten_style_info_empty() {
    let style_info: StyleInfo = HashMap::new();
    let flattened_info = flatten_style_info(style_info);
    assert!(flattened_info.is_empty());
  }

  #[test]
  fn test_flatten_style_info_single_css_no_imports() {
    let mut style_info: StyleInfo = HashMap::new();
    let rule = StyleRule {
      selectors: vec![vec![(
        vec!["div".to_string()],
        vec![":hover".to_string()],
        vec!["::before".to_string()],
        vec![">".to_string()],
      )]],
      declarations: vec![("color".to_string(), "red".to_string())],
    };

    style_info.insert(
      1,
      StyleSheet {
        rules: vec![rule],
        at_rules: "@media screen { }".to_string(),
        imports: vec![],
      },
    );

    let flattened_info = flatten_style_info(style_info);

    assert_eq!(flattened_info.len(), 1);
    let flattened_sheet = &flattened_info[0];
    assert_eq!(flattened_sheet.imported_by, vec![1]);
    assert_eq!(flattened_sheet.at_rules, "@media screen { }");
    assert_eq!(flattened_sheet.rules.len(), 1);

    let rule = &flattened_sheet.rules[0];
    assert_eq!(rule.selectors.len(), 1);
    assert_eq!(rule.selectors[0][0].0, vec!["div"]);
    assert_eq!(rule.selectors[0][0].1, vec![":hover"]);
    assert_eq!(rule.selectors[0][0].2, vec!["::before"]);
    assert_eq!(rule.selectors[0][0].3, vec![">"]);
    assert_eq!(
      rule.declarations,
      vec![("color".to_string(), "red".to_string())]
    );
  }

  #[test]
  fn test_flatten_style_info_multiple_css_no_imports() {
    let mut style_info: StyleInfo = HashMap::new();

    style_info.insert(
      1,
      StyleSheet {
        rules: vec![],
        at_rules: "at-rule-1".to_string(),
        imports: vec![],
      },
    );

    style_info.insert(
      2,
      StyleSheet {
        rules: vec![],
        at_rules: "at-rule-2".to_string(),
        imports: vec![],
      },
    );

    let flattened_info = flatten_style_info(style_info);

    assert_eq!(flattened_info.len(), 2);

    let flattened_sheet_1 = flattened_info
      .iter()
      .find(|s| s.at_rules == "at-rule-1")
      .unwrap();
    assert_eq!(flattened_sheet_1.imported_by, vec![1]);

    let flattened_sheet_2 = flattened_info
      .iter()
      .find(|s| s.at_rules == "at-rule-2")
      .unwrap();
    assert_eq!(flattened_sheet_2.imported_by, vec![2]);
  }

  #[test]
  fn test_flatten_style_info_complex_import_chain() {
    let mut style_info: StyleInfo = HashMap::new();

    // Create a more complex dependency graph:
    // 1 -> 2, 3
    // 2 -> 4
    // 3 -> 4
    // 4 -> (none)
    style_info.insert(
      1,
      StyleSheet {
        rules: vec![],
        at_rules: "css-1".to_string(),
        imports: vec![2, 3],
      },
    );

    style_info.insert(
      2,
      StyleSheet {
        rules: vec![],
        at_rules: "css-2".to_string(),
        imports: vec![4],
      },
    );

    style_info.insert(
      3,
      StyleSheet {
        rules: vec![],
        at_rules: "css-3".to_string(),
        imports: vec![4],
      },
    );

    style_info.insert(
      4,
      StyleSheet {
        rules: vec![],
        at_rules: "css-4".to_string(),
        imports: vec![],
      },
    );

    let flattened_info = flatten_style_info(style_info);

    assert_eq!(flattened_info.len(), 4);

    // CSS 1 is only imported by itself
    let sheet1 = flattened_info
      .iter()
      .find(|s| s.at_rules == "css-1")
      .unwrap();
    let imported_by_1: HashSet<i32> = sheet1.imported_by.iter().cloned().collect();
    assert_eq!(imported_by_1, [1].iter().cloned().collect::<HashSet<i32>>());

    // CSS 2 is imported by itself and CSS 1
    let sheet2 = flattened_info
      .iter()
      .find(|s| s.at_rules == "css-2")
      .unwrap();
    let imported_by_2: HashSet<i32> = sheet2.imported_by.iter().cloned().collect();
    assert_eq!(
      imported_by_2,
      [1, 2].iter().cloned().collect::<HashSet<i32>>()
    );

    // CSS 3 is imported by itself and CSS 1
    let sheet3 = flattened_info
      .iter()
      .find(|s| s.at_rules == "css-3")
      .unwrap();
    let imported_by_3: HashSet<i32> = sheet3.imported_by.iter().cloned().collect();
    assert_eq!(
      imported_by_3,
      [1, 3].iter().cloned().collect::<HashSet<i32>>()
    );

    // CSS 4 is imported by CSS 1, 2, 3, and itself
    let sheet4 = flattened_info
      .iter()
      .find(|s| s.at_rules == "css-4")
      .unwrap();
    let imported_by_4: HashSet<i32> = sheet4.imported_by.iter().cloned().collect();
    assert_eq!(
      imported_by_4,
      [1, 2, 3, 4].iter().cloned().collect::<HashSet<i32>>()
    );
  }

  #[test]
  fn test_flatten_style_info_with_rules_and_content() {
    let mut style_info: StyleInfo = HashMap::new();

    let rule1 = StyleRule {
      selectors: vec![
        vec![(
          vec!["h1".to_string(), "h2".to_string()],
          vec![":hover".to_string()],
          vec![],
          vec![],
        )],
        vec![(
          vec!["p".to_string()],
          vec![":active".to_string(), ":focus".to_string()],
          vec!["::after".to_string()],
          vec!["+".to_string(), "~".to_string()],
        )],
      ],
      declarations: vec![
        ("color".to_string(), "blue".to_string()),
        ("font-size".to_string(), "16px".to_string()),
      ],
    };

    let rule2 = StyleRule {
      selectors: vec![vec![(
        vec!["span".to_string()],
        vec![],
        vec!["::before".to_string()],
        vec![">".to_string()],
      )]],
      declarations: vec![("margin".to_string(), "10px".to_string())],
    };

    style_info.insert(
      1,
      StyleSheet {
        rules: vec![rule1.clone(), rule2.clone()],
        at_rules: "@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }".to_string(),
        imports: vec![2],
      },
    );

    style_info.insert(
      2,
      StyleSheet {
        rules: vec![],
        at_rules: "@media (max-width: 768px) { .mobile { display: block; } }".to_string(),
        imports: vec![],
      },
    );

    let flattened_info = flatten_style_info(style_info);

    assert_eq!(flattened_info.len(), 2);

    let flattened_sheet_1 = flattened_info.iter().find(|s| !s.rules.is_empty()).unwrap();
    assert_eq!(flattened_sheet_1.rules.len(), 2);
    assert_eq!(
      flattened_sheet_1.at_rules,
      "@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }"
    );

    // Test first rule
    let rule = &flattened_sheet_1.rules[0];
    assert_eq!(rule.selectors.len(), 2);
    assert_eq!(rule.selectors[0][0].0, vec!["h1", "h2"]);
    assert_eq!(rule.selectors[0][0].1, vec![":hover"]);
    assert_eq!(rule.selectors[1][0].0, vec!["p"]);
    assert_eq!(rule.selectors[1][0].1, vec![":active", ":focus"]);
    assert_eq!(rule.selectors[1][0].2, vec!["::after"]);
    assert_eq!(rule.selectors[1][0].3, vec!["+", "~"]);
    assert_eq!(
      rule.declarations,
      vec![
        ("color".to_string(), "blue".to_string()),
        ("font-size".to_string(), "16px".to_string())
      ]
    );

    // Test second rule
    let rule2_found = &flattened_sheet_1.rules[1];
    assert_eq!(rule2_found.selectors.len(), 1);
    assert_eq!(rule2_found.selectors[0][0].0, vec!["span"]);
    assert_eq!(rule2_found.selectors[0][0].2, vec!["::before"]);
    assert_eq!(rule2_found.selectors[0][0].3, vec![">"]);
    assert_eq!(
      rule2_found.declarations,
      vec![("margin".to_string(), "10px".to_string())]
    );

    let flattened_sheet_2 = flattened_info.iter().find(|s| s.rules.is_empty()).unwrap();
    assert_eq!(flattened_sheet_2.rules.len(), 0);
    assert_eq!(
      flattened_sheet_2.at_rules,
      "@media (max-width: 768px) { .mobile { display: block; } }"
    );
  }

  #[test]
  fn test_flatten_style_info_multiple_imports_same_css() {
    let mut style_info: StyleInfo = HashMap::new();

    // CSS 1 and CSS 2 both import CSS 3
    style_info.insert(
      1,
      StyleSheet {
        rules: vec![],
        at_rules: String::new(),
        imports: vec![3],
      },
    );

    style_info.insert(
      2,
      StyleSheet {
        rules: vec![],
        at_rules: String::new(),
        imports: vec![3],
      },
    );

    style_info.insert(
      3,
      StyleSheet {
        rules: vec![],
        at_rules: String::new(),
        imports: vec![],
      },
    );

    let flattened_info = flatten_style_info(style_info);

    // CSS 3 should be imported by CSS 1, CSS 2, and itself
    let sheet3 = flattened_info
      .iter()
      .find(|s| s.imported_by.contains(&3))
      .unwrap();
    let imported_by_3: HashSet<i32> = sheet3.imported_by.iter().cloned().collect();
    assert_eq!(
      imported_by_3,
      [1, 2, 3].iter().cloned().collect::<HashSet<i32>>()
    );
  }

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
