use std::collections::{HashMap, HashSet};

pub struct StyleRule {
  /**
   * Selectors are stored as 4 separate lists:
   * - plain selectors (e.g., "div", "span")
   * - pseudo-classes (e.g., ":hover", ":active")
   * - pseudo-elements (e.g., "::before", "::after")
   * - combinator selectors (e.g., ">", "+", "~")
   */
  pub selectors: Vec<(Vec<String>, Vec<String>, Vec<String>, Vec<String>)>,
  pub declarations: Vec<(String, String)>,
}

pub struct StyleSheet {
  pub rules: Vec<StyleRule>,
  pub at_rules: String,
  pub imports: Vec<i32>,
}

/**
 * key: cssId
 * value: StyleSheet
 */
pub type StyleInfo = HashMap<i32, StyleSheet>;

pub struct FlattenedStyleSheet {
  pub rules: Vec<StyleRule>,
  pub at_rules: String,
  pub imported_by: Vec<i32>,
}

/**
 * key: cssId
 * value: FlattenedStyleSheet
 */
type FlattenedStyleInfo = HashMap<i32, FlattenedStyleSheet>;

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
  let mut queue: Vec<i32> = Vec::new();
  let mut sorted_css_ids: Vec<i32> = Vec::new();
  let mut imported_by_map: HashMap<i32, HashSet<i32>> = HashMap::new();
  let mut flattened_style_info: FlattenedStyleInfo = HashMap::new();

  for (css_id, style_sheet) in &style_info {
    in_degree_map.entry(*css_id).or_insert(0);
    for imported_css_id in &style_sheet.imports {
      let in_degree = in_degree_map.entry(*imported_css_id).or_insert(0);
      *in_degree += 1;
    }
  }

  // Initialize the queue with nodes having in-in_degree of 0
  for (css_id, in_degree) in &in_degree_map {
    if *in_degree == 0 {
      queue.push(*css_id);
    }
  }

  // Process the queue
  while !queue.is_empty() {
    let css_id = queue.remove(0);
    sorted_css_ids.push(css_id);

    // Decrease the in-in_degree of all imported CSS files
    for imported_css_id in &style_info[&css_id].imports {
      let in_degree = in_degree_map.entry(*imported_css_id).or_insert(0);
      *in_degree -= 1;
      if *in_degree == 0 {
        queue.push(*imported_css_id);
      }
    }
  }

  // Step 2. generate deps;
  for css_id in &sorted_css_ids {
    let style_sheet = &style_info[css_id];
    // mark it is imported by itself
    for imported_css_id in &style_sheet.imports {
      let current_css_id_imported_by = imported_by_map
        .entry(*css_id)
        .or_insert(HashSet::from([*css_id]));
      let dependent_css_id_import_by_map = imported_by_map.entry(*imported_css_id).or_default();
      dependent_css_id_import_by_map.extend(current_css_id_imported_by.iter());
    }
  }

  // Step 3. generate flattened style info
  for css_id in &sorted_css_ids {
    let style_sheet = style_info.remove(css_id).unwrap();
    let imported_by_set = imported_by_map.get(css_id).unwrap();
    let imported_by: Vec<i32> = imported_by_set.iter().cloned().collect();
    let flattened_style_sheet = FlattenedStyleSheet {
      rules: style_sheet.rules,
      at_rules: style_sheet.at_rules,
      imported_by,
    };
    flattened_style_info.insert(*css_id, flattened_style_sheet);
  }

  flattened_style_info
}

#[cfg(test)]
mod tests {
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

    let imported_by_1 = flattened_info
      .get(&1)
      .unwrap()
      .imported_by
      .iter()
      .cloned()
      .collect::<HashSet<i32>>();
    let imported_by_2 = flattened_info
      .get(&2)
      .unwrap()
      .imported_by
      .iter()
      .cloned()
      .collect::<HashSet<i32>>();
    let imported_by_3 = flattened_info
      .get(&3)
      .unwrap()
      .imported_by
      .iter()
      .cloned()
      .collect::<HashSet<i32>>();

    let expected_imported_by_1: HashSet<i32> = [1].iter().cloned().collect();
    let expected_imported_by_2: HashSet<i32> = [1, 2].iter().cloned().collect();
    let expected_imported_by_3: HashSet<i32> = [1, 2, 3].iter().cloned().collect();

    assert_eq!(imported_by_1, expected_imported_by_1);
    assert_eq!(imported_by_2, expected_imported_by_2);
    assert_eq!(imported_by_3, expected_imported_by_3);
  }
}
