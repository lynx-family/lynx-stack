/**
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
use super::raw_style_info::{RawStyleInfo, Rule};
use fnv::{FnvHashMap, FnvHashSet};

#[derive(Default)]
pub(super) struct FlattenedStyleSheet {
  pub(super) imported_by: Vec<i32>,
  pub(super) rules: Vec<Rule>,
}

#[derive(Default)]
pub(super) struct FlattenedStyleInfo {
  pub(super) css_id_to_style_sheet: FnvHashMap<i32, FlattenedStyleSheet>,
  pub(super) style_content_str_size_hint: usize,
}

impl From<RawStyleInfo> for FlattenedStyleInfo {
  fn from(mut style_info: RawStyleInfo) -> Self {
    // Step 1. Topological sorting
    /*
     * kahn's algorithm
     * 1. The RawStyleInfo is already equivalent to a adjacency list. (cssId, import)
     * 2. The RawStyleInfo is a DAG therefore we don't need to do cyclic detection
     */
    let mut in_degree_map: FnvHashMap<i32, i32> = FnvHashMap::default();
    let mut sorted_css_ids: Vec<i32> = Vec::with_capacity(style_info.css_id_to_style_sheet.len());
    let mut imported_by_map: FnvHashMap<i32, FnvHashSet<i32>> = FnvHashMap::default();
    let mut flattened_style_info = FlattenedStyleInfo::default();

    for (css_id, style_sheet) in style_info.css_id_to_style_sheet.iter() {
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
      if let Some(style_sheet) = style_info.css_id_to_style_sheet.get(&css_id) {
        for imported_css_id in style_sheet.imports.iter() {
          let in_degree = in_degree_map.entry(*imported_css_id).or_insert(1);
          *in_degree -= 1;
          if *in_degree == 0 {
            sorted_css_ids.push(*imported_css_id);
          }
        }
      }
    }

    // Step 2. generate deps;
    for css_id in sorted_css_ids.iter() {
      if let Some(style_sheet) = style_info.css_id_to_style_sheet.get(css_id) {
        // mark it is imported by itself
        imported_by_map.entry(*css_id).or_default().insert(*css_id);
        let current_css_id_imported_by = imported_by_map.get(css_id).unwrap().clone();
        for importing_css_id in style_sheet.imports.iter() {
          let importing_css_id_imported_by = imported_by_map.entry(*importing_css_id).or_default();
          importing_css_id_imported_by.extend(current_css_id_imported_by.iter().cloned());
        }
      }
    }

    // Step 3. generate flattened style info
    for css_id in sorted_css_ids.iter() {
      if let Some(style_sheet) = style_info.css_id_to_style_sheet.remove(css_id) {
        let imported_by_set = imported_by_map.get(css_id).unwrap();
        let imported_by: Vec<i32> = imported_by_set.iter().cloned().collect();
        let flattened_style_sheet = FlattenedStyleSheet {
          imported_by,
          rules: style_sheet.rules,
        };
        flattened_style_info
          .css_id_to_style_sheet
          .insert(*css_id, flattened_style_sheet);
      }
    }
    flattened_style_info.style_content_str_size_hint = style_info.style_content_str_size_hint;

    flattened_style_info
  }
}

#[cfg(test)]
mod tests {
  use super::super::raw_style_info::StyleSheet;
  use super::{FlattenedStyleInfo, RawStyleInfo};
  use fnv::FnvHashSet;

  #[test]
  fn test_flatten_style_info() {
    let mut style_info: RawStyleInfo = RawStyleInfo::new();
    style_info.css_id_to_style_sheet.insert(
      1,
      StyleSheet {
        rules: vec![],
        imports: vec![2],
      },
    );
    style_info.css_id_to_style_sheet.insert(
      2,
      StyleSheet {
        rules: vec![],
        imports: vec![3],
      },
    );
    style_info.css_id_to_style_sheet.insert(
      3,
      StyleSheet {
        rules: vec![],
        imports: vec![],
      },
    );

    let flattened_info: FlattenedStyleInfo = style_info.into();

    // Since the output is a Vec, we need to find the items.
    // The order is not guaranteed, so we'll check for existence and properties.
    assert_eq!(flattened_info.css_id_to_style_sheet.len(), 3);

    let _sheet1 = flattened_info
      .css_id_to_style_sheet
      .iter()
      .find(|(_, s)| s.imported_by.contains(&1) && s.imported_by.len() == 1)
      .unwrap();
    let _sheet2 = flattened_info
      .css_id_to_style_sheet
      .iter()
      .find(|(_, s)| s.imported_by.contains(&2) && s.imported_by.len() == 2)
      .unwrap();
    let _sheet3 = flattened_info
      .css_id_to_style_sheet
      .iter()
      .find(|(_, s)| s.imported_by.contains(&3) && s.imported_by.len() == 3)
      .unwrap();

    let imported_by_1: FnvHashSet<i32> = flattened_info
      .css_id_to_style_sheet
      .get(&1)
      .unwrap()
      .imported_by
      .iter()
      .cloned()
      .collect();
    let imported_by_2: FnvHashSet<i32> = flattened_info
      .css_id_to_style_sheet
      .get(&2)
      .unwrap()
      .imported_by
      .iter()
      .cloned()
      .collect();
    let imported_by_3: FnvHashSet<i32> = flattened_info
      .css_id_to_style_sheet
      .get(&3)
      .unwrap()
      .imported_by
      .iter()
      .cloned()
      .collect();

    let expected_imported_by_1: FnvHashSet<i32> = [1].iter().cloned().collect();
    let expected_imported_by_2: FnvHashSet<i32> = [1, 2].iter().cloned().collect();
    let expected_imported_by_3: FnvHashSet<i32> = [1, 2, 3].iter().cloned().collect();

    assert_eq!(imported_by_1, expected_imported_by_1);
    assert_eq!(imported_by_2, expected_imported_by_2);
    assert_eq!(imported_by_3, expected_imported_by_3);
  }

  #[test]
  fn test_flatten_style_info_empty() {
    let style_info: RawStyleInfo = RawStyleInfo::new();
    let flattened_info: FlattenedStyleInfo = style_info.into();
    assert!(flattened_info.css_id_to_style_sheet.is_empty());
  }

  #[test]
  fn test_flatten_style_info_diamond() {
    let mut style_info: RawStyleInfo = RawStyleInfo::new();
    // 1 -> 2, 1 -> 3
    style_info.css_id_to_style_sheet.insert(
      1,
      StyleSheet {
        rules: vec![],
        imports: vec![2, 3],
      },
    );
    // 2 -> 4
    style_info.css_id_to_style_sheet.insert(
      2,
      StyleSheet {
        rules: vec![],
        imports: vec![4],
      },
    );
    // 3 -> 4
    style_info.css_id_to_style_sheet.insert(
      3,
      StyleSheet {
        rules: vec![],
        imports: vec![4],
      },
    );
    // 4 -> []
    style_info.css_id_to_style_sheet.insert(
      4,
      StyleSheet {
        rules: vec![],
        imports: vec![],
      },
    );

    let flattened_info: FlattenedStyleInfo = style_info.into();

    let imported_by_4: FnvHashSet<i32> = flattened_info
      .css_id_to_style_sheet
      .get(&4)
      .unwrap()
      .imported_by
      .iter()
      .cloned()
      .collect();
    let expected_imported_by_4: FnvHashSet<i32> = [1, 2, 3, 4].iter().cloned().collect();
    assert_eq!(imported_by_4, expected_imported_by_4);
  }

  #[test]
  fn test_flatten_style_info_disjoint() {
    let mut style_info: RawStyleInfo = RawStyleInfo::new();
    // 1 -> 2
    style_info.css_id_to_style_sheet.insert(
      1,
      StyleSheet {
        rules: vec![],
        imports: vec![2],
      },
    );
    style_info.css_id_to_style_sheet.insert(
      2,
      StyleSheet {
        rules: vec![],
        imports: vec![],
      },
    );
    // 3 -> 4
    style_info.css_id_to_style_sheet.insert(
      3,
      StyleSheet {
        rules: vec![],
        imports: vec![4],
      },
    );
    style_info.css_id_to_style_sheet.insert(
      4,
      StyleSheet {
        rules: vec![],
        imports: vec![],
      },
    );

    let flattened_info: FlattenedStyleInfo = style_info.into();

    let imported_by_2: FnvHashSet<i32> = flattened_info
      .css_id_to_style_sheet
      .get(&2)
      .unwrap()
      .imported_by
      .iter()
      .cloned()
      .collect();
    let expected_imported_by_2: FnvHashSet<i32> = [1, 2].iter().cloned().collect();
    assert_eq!(imported_by_2, expected_imported_by_2);

    let imported_by_4: FnvHashSet<i32> = flattened_info
      .css_id_to_style_sheet
      .get(&4)
      .unwrap()
      .imported_by
      .iter()
      .cloned()
      .collect();
    let expected_imported_by_4: FnvHashSet<i32> = [3, 4].iter().cloned().collect();
    assert_eq!(imported_by_4, expected_imported_by_4);
  }

  #[test]
  fn test_flatten_style_info_cycle() {
    let mut style_info: RawStyleInfo = RawStyleInfo::new();
    // 1 -> 2
    style_info.css_id_to_style_sheet.insert(
      1,
      StyleSheet {
        rules: vec![],
        imports: vec![2],
      },
    );
    // 2 -> 1 (cycle)
    style_info.css_id_to_style_sheet.insert(
      2,
      StyleSheet {
        rules: vec![],
        imports: vec![1],
      },
    );

    let flattened_info: FlattenedStyleInfo = style_info.into();

    // In a cycle, topological sort might fail or produce partial results depending on implementation.
    // Kahn's algorithm will output nodes with 0 in-degree.
    // Here both 1 and 2 have in-degree 1.
    // So sorted_css_ids will be empty.
    // And flattened_info will be empty.

    assert!(flattened_info.css_id_to_style_sheet.is_empty());
  }
}
