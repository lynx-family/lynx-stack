use super::{StyleInfo, StyleRule};
use std::collections::{HashMap, HashSet};

pub(crate) struct FlattenedStyleSheet {
  pub rules: Vec<StyleRule>,
  pub at_rules: String,
  pub imported_by: Vec<i32>,
}

/**
 * key: cssId
 * value: StyleSheet
 */
pub(crate) type FlattenedStyleInfo = Vec<FlattenedStyleSheet>;

/**
 * get Transitive Closure of a Direct Acyclic Graph (DAG)
 * 1. for each css, find all the imported by css files (directly and indirectly)
 * 2. for each css, find all the importing css files (directly and indirectly)
 * 3. return the flattened style info, do not modify the content and rules
 */
pub(crate) fn flatten_style_info(mut style_info: StyleInfo) -> FlattenedStyleInfo {
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
#[cfg(test)]
mod tests {
  use super::super::super::raw_template::style_info::StyleSheet;
  use super::*;
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
        rules: vec![rule1, rule2],
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
}
