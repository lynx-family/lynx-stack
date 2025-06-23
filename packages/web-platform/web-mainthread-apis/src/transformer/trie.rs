pub struct TrieNode {
  /*
  Use bit 0 to 27 to show if there may be a key in current position
  0 - 26 for a - z and A-Z
  27 for all other characters
  */
  char_map: u32,
  leaves: [Option<&'static [Option<TrieNodeLeaf>]>; 27],
}

pub struct TrieNodeLeaf {
  /*
  Use bit 0 to 27 to show if there may be a key in current position
  0 - 26 for a - z and A-Z
  27 for all other characters
  */
  char_map: u32,
  result: [Option<&'static str>; 27],
}

#[macro_export]
macro_rules! get_trie_char_code {
  ($code:expr) => {
    if $code >= ('a' as u16) && $code <= ('z' as u16) {
      $code - 'a' as u16
    } else if $code >= ('A' as u16) && $code <= ('Z' as u16) {
      $code - ('A' as u16)
    } else {
      26 // for all other characters
    }
  };
}

const RENAME_RULES_RAW: [(&'static str, &'static str); 7] = [
  ("flex-direction", "--flex-direction"),
  ("flex-wrap", "--flex-wrap"),
  ("flex-grow", "--flex-grow"),
  ("flex-shrink", "--flex-shrink"),
  ("flex-basis", "--flex-basis"),
  ("list-main-axis-gap", "--list-main-axis-gap"),
  ("list-cross-axis-gap", "--list-cross-axis-gap"),
];

const DISPLAY_REPLACE_RULE: [(&str, &str); 2] = [
  (
    "linear",
    "--lynx-display-toggle:var(--lynx-display-linear); --lynx-display:linear; display:flex",
  ),
  (
    "flex",
    "--lynx-display-toggle:var(--lynx-display-flex); --lynx-display:flex; display:flex",
  ),
];

const DIRECTION_REPLACE_RULE: [(&str, &str); 1] = [("lynx-rtl", "direction:rtl")];

const LINEAR_ORIENTATION_REPLACE_RULE: [(&str, &str); 4] = [
  ("horizontal", "--lynx-linear-orientation:horizontal; --lynx-linear-orientation-toggle:var(--lynx-linear-orientation-horizontal)"),
  ("horizontal-reverse", "--lynx-linear-orientation:horizontal-reverse; --lynx-linear-orientation-toggle:var(--lynx-linear-orientation-horizontal-reverse)"),
  ("vertical", "--lynx-linear-orientation:vertical; --lynx-linear-orientation-toggle:var(--lynx-linear-orientation-vertical)"),
  ("vertical-reverse", "--lynx-linear-orientation:vertical-reverse; --lynx-linear-orientation-toggle:var(--lynx-linear-orientation-vertical-reverse)"),
];

const LINEAR_DIRECTION_REPLACE_RULE: [(&str, &str); 4] = [
  ("row", "--lynx-linear-orientation:horizontal; --lynx-linear-orientation-toggle:var(--lynx-linear-orientation-horizontal)"),
  ("row-reverse", "--lynx-linear-orientation:horizontal-reverse; --lynx-linear-orientation-toggle:var(--lynx-linear-orientation-horizontal-reverse)"),
  ("column", "--lynx-linear-orientation:vertical; --lynx-linear-orientation-toggle:var(--lynx-linear-orientation-vertical)"),
  ("column-reverse", "--lynx-linear-orientation:vertical-reverse; --lynx-linear-orientation-toggle:var(--lynx-linear-orientation-vertical-reverse)"),
];

const LINEAR_GRAVITY_REPLACE_RULE: [(&str, &str); 10] = [
  ("top", "--justify-content-column:flex-start;--justify-content-column-reverse:flex-end;--justify-content-row:flex-start;--justify-content-row-reverse:flex-start"),
  ("bottom", "--justify-content-column:flex-end;--justify-content-column-reverse:flex-start;--justify-content-row:flex-start;--justify-content-row-reverse:flex-start"),
  ("left", "--justify-content-column:flex-start;--justify-content-column-reverse:flex-start;--justify-content-row:flex-start;--justify-content-row-reverse:flex-end"),
  ("right", "--justify-content-column:flex-start;--justify-content-column-reverse:flex-start;--justify-content-row:flex-end;--justify-content-row-reverse:flex-start"),
  ("center-vertical", "--justify-content-column:center;--justify-content-column-reverse:center;--justify-content-row:flex-start;--justify-content-row-reverse:flex-start"),
  ("center-horizontal", "--justify-content-column:flex-start;--justify-content-column-reverse:flex-start;--justify-content-row:center;--justify-content-row-reverse:center"),
  ("start", "--justify-content-column:flex-start;--justify-content-column-reverse:flex-start;--justify-content-row:flex-start;--justify-content-row-reverse:flex-start"),
  ("end", "--justify-content-column:flex-end;--justify-content-column-reverse:flex-end;--justify-content-row:flex-end;--justify-content-row-reverse:flex-end"),
  ("center", "--justify-content-column:center;--justify-content-column-reverse:center;--justify-content-row:center;--justify-content-row-reverse:center"),
  ("space-between", "--justify-content-column:space-between;--justify-content-column-reverse:space-between;--justify-content-row:space-between;--justify-content-row-reverse:space-between"),
];

const LINEAR_CROSS_GRAVITY_REPLACE_RULE: [(&str, &str); 4] = [
  ("start", "align-items:start"),
  ("end", "align-items:end"),
  ("center", "align-items:center"),
  ("stretch", "align-items:stretch"),
];

const LINEAR_LAYOUT_GRAVITY_REPLACE_RULE: [(&str, &str); 13] = [
  ("none", "--align-self-row:auto; --align-self-column:auto"),
  (
    "stretch",
    "--align-self-row:stretch; --align-self-column:stretch",
  ),
  ("top", "--align-self-row:start; --align-self-column:auto"),
  ("bottom", "--align-self-row:end, --align-self-column:auto"),
  ("left", "--align-self-row:auto; --align-self-column:start"),
  ("right", "--align-self-row:auto; --align-self-column:end"),
  ("start", "--align-self-row:auto; --align-self-column:start"),
  ("end", "--align-self-row:auto; --align-self-column:end"),
  (
    "center",
    "--align-self-row:center; --align-self-column:center",
  ),
  (
    "center-vertical",
    "--align-self-row:center; --align-self-column:start",
  ),
  (
    "center-horizontal",
    "--align-self-row:start; --align-self-column:center",
  ),
  (
    "fill-vertical",
    "--align-self-row:stretch; --align-self-column:auto",
  ),
  (
    "fill-horizontal",
    "--align-self-row:auto; --align-self-column:stretch",
  ),
];

const JUSTIFY_CONTENT_REPLACE_RULE: [(&str, &str); 2] = [
  ("start", "justify-content:flex-start ;justify-content:start"),
  ("end", "justify-content:flex-end ;justify-content:end"),
];

const fn get_rule_size(rule: &[(&'static str, &'static str)]) -> usize {
  let mut max_len = 0;
  let mut ii = 0;
  while ii < rule.len() {
    let (key, _) = rule[ii];
    let key_len = key.len();
    if key_len > max_len {
      max_len = key_len;
    }
    ii += 1;
  }
  max_len
}

const fn create_trie_node_leaf<const LEN: usize>(
  rule: &'static [(&str, &str)],
) -> [Option<TrieNodeLeaf>; LEN] {
  let mut trie_node_leaves: [Option<TrieNodeLeaf>; LEN] = [const { None }; LEN];
  let mut ii = 0;
  while ii < rule.len() {
    let (key, value) = rule[ii];
    set_trie_node_leaf(&mut trie_node_leaves, key, value);
    ii += 1;
  }
  trie_node_leaves
}

pub const RENAME_RULE: [Option<TrieNodeLeaf>; get_rule_size(&RENAME_RULES_RAW)] =
  create_trie_node_leaf(&RENAME_RULES_RAW);

macro_rules! set_trie_node {
  ($trie_nodes:expr, $key1:expr, $rule:expr) => {
    let bytes = $key1.as_bytes();
    let mut ii = 0;
    while ii < bytes.len() {
      let byte = bytes[ii];
      let code = get_trie_char_code!(byte as u16) as usize;
      if $trie_nodes[ii].is_none() {
        // Initialize a new TrieNode if it doesn't exist
        $trie_nodes[ii] = Some(TrieNode {
          char_map: 0,
          leaves: [const { None }; 27],
        });
      };
      $trie_nodes[ii].as_mut().unwrap().char_map |= 1 << code;
      if (ii + 1) == bytes.len() {
        // This is the last character in the key, set the leaf
        static LEAF: [Option<TrieNodeLeaf>; get_rule_size($rule)] = create_trie_node_leaf($rule);
        $trie_nodes[ii].as_mut().unwrap().leaves[code] = Some(&LEAF);
      }
      ii += 1;
    }
  };
}

const REPLACE_RULES_RAW_SIZE: usize = {
  let mut max_len = 0;
  let mut ii = 0;
  let rules = [
    "display",
    "direction",
    "linear-orientation",
    "linear-direction",
    "linear-gravity",
    "linear-cross-gravity",
    "linear-layout-gravity",
    "justify-content",
  ];
  while ii < rules.len() {
    let key = rules[ii];
    let key_len = key.len();
    if key_len > max_len {
      max_len = key_len;
    }
    ii += 1;
  }
  max_len
};

pub const REPLACE_RULE: [Option<TrieNode>; REPLACE_RULES_RAW_SIZE] = {
  let mut trie_nodes: [Option<TrieNode>; REPLACE_RULES_RAW_SIZE] =
    [const { None }; REPLACE_RULES_RAW_SIZE];
  set_trie_node!(&mut trie_nodes, "display", &DISPLAY_REPLACE_RULE);
  set_trie_node!(&mut trie_nodes, "direction", &DIRECTION_REPLACE_RULE);
  set_trie_node!(
    &mut trie_nodes,
    "linear-orientation",
    &LINEAR_ORIENTATION_REPLACE_RULE
  );
  set_trie_node!(
    &mut trie_nodes,
    "linear-direction",
    &LINEAR_DIRECTION_REPLACE_RULE
  );
  set_trie_node!(
    &mut trie_nodes,
    "linear-gravity",
    &LINEAR_GRAVITY_REPLACE_RULE
  );
  set_trie_node!(
    &mut trie_nodes,
    "linear-cross-gravity",
    &LINEAR_CROSS_GRAVITY_REPLACE_RULE
  );
  set_trie_node!(
    &mut trie_nodes,
    "linear-layout-gravity",
    &LINEAR_LAYOUT_GRAVITY_REPLACE_RULE
  );
  set_trie_node!(
    &mut trie_nodes,
    "justify-content",
    &JUSTIFY_CONTENT_REPLACE_RULE
  );
  // Return the initialized trie nodes
  trie_nodes
};

const fn set_trie_node_leaf(
  trie_nodes: &mut [Option<TrieNodeLeaf>],
  key: &str,
  value: &'static str,
) {
  let bytes = key.as_bytes();
  let mut ii = 0;
  while ii < bytes.len() {
    let byte = bytes[ii];
    let code = get_trie_char_code!(byte as u16) as usize;
    if trie_nodes[ii].is_none() {
      // Initialize a new TrieNodeLeaf if it doesn't exist
      trie_nodes[ii] = Some(TrieNodeLeaf {
        char_map: 0,
        result: [const { None }; 27],
      });
    }
    trie_nodes[ii].as_mut().unwrap().char_map |= 1 << code;
    if (ii + 1) == bytes.len() {
      // This is the last character in the key, set the value
      trie_nodes[ii].as_mut().unwrap().result[code] = Some(value);
    }
    ii += 1;
  }
}

pub fn get_trie_leaf_value(
  source: &[u16],
  start: usize,
  end: usize,
  leaves: &'static [Option<TrieNodeLeaf>],
) -> Option<&'static str> {
  let mut ii = 0;
  let len = core::cmp::min(end - start, source.len());
  while ii < len && ii < leaves.len() {
    let raw_code = source[start + ii];
    let code = get_trie_char_code!(raw_code) as usize;
    if let Some(trie_node_leaf) = &leaves[ii] {
      if trie_node_leaf.char_map & (1 << code) == 0 {
        // match failed
        return const { None };
      }
      if ii + 1 == len {
        // If we reached the end of the source, return the result
        return trie_node_leaf.result[code];
      }
    }
    ii += 1;
  }
  return const { None };
}

pub fn get_trie_node_value(
  source: &[u16],
  start: usize,
  end: usize,
  trie_nodes: &'static [Option<TrieNode>],
) -> Option<&'static [Option<TrieNodeLeaf>]> {
  let mut ii = 0;
  let len = core::cmp::min(end - start, source.len());
  while ii < len && ii < trie_nodes.len() {
    let raw_code = source[start + ii];
    let code = get_trie_char_code!(raw_code) as usize;
    if let Some(trie_node) = &trie_nodes[ii] {
      if trie_node.char_map & (1 << code) == 0 {
        // match failed
        return const { None };
      }
      if ii + 1 == len {
        // If we reached the end of the source, return the leaves
        return trie_node.leaves[code];
      }
    }
    ii += 1;
  }
  return const { None };
}
#[macro_export]
macro_rules! get_rename_rule_value {
  ($source:expr, $name_start:expr, $name_end:expr) => {
    $crate::transformer::trie::get_trie_leaf_value(
      $source,
      $name_start,
      $name_end,
      &$crate::transformer::trie::RENAME_RULE,
    )
  };
}

#[macro_export]
macro_rules! get_replace_rule_value {
  ($name_source:expr, $name_start:expr, $name_end:expr, $value_source:expr, $value_start:expr, $value_end:expr) => {
    if let Some(leaves) = $crate::transformer::trie::get_trie_node_value(
      $name_source,
      $name_start,
      $name_end,
      &$crate::transformer::trie::REPLACE_RULE,
    ) {
      if let Some(value) = $crate::transformer::trie::get_trie_leaf_value(
        $value_source,
        $value_start,
        $value_end,
        leaves,
      ) {
        Some(value)
      } else {
        None
      }
    } else {
      None
    }
  };
}

#[cfg(test)]
mod tests {

  #[test]
  fn test_rename_rule_flex_direction() {
    let source = "flex-direction:row".as_bytes();
    let source: Vec<u16> = source.iter().map(|&b| b as u16).collect();
    let name_start = 0;
    let name_end = source.len() - 4;
    let result = get_rename_rule_value!(&source, name_start, name_end);
    assert_eq!(result, Some("--flex-direction"));
  }

  #[test]
  fn test_rename_rule_flex_direction_at_mid() {
    let source = "height:1px;flex-direction:row".as_bytes();
    let offset = "height:1px;".len();
    let source: Vec<u16> = source.iter().map(|&b| b as u16).collect();
    let name_start = offset;
    let name_end = source.len() - 4;
    let result = get_rename_rule_value!(&source, name_start, name_end);
    assert_eq!(result, Some("--flex-direction"));
  }

  #[test]
  fn test_replace_rule_display_linear() {
    let source = "display:linear".as_bytes();
    let source: Vec<u16> = source.iter().map(|&b| b as u16).collect();
    let name_start = 0;
    let name_end = 7;
    let value_start = 8;
    let value_end = source.len();
    let result = get_replace_rule_value!(
      &source,
      name_start,
      name_end,
      &source,
      value_start,
      value_end
    );
    assert_eq!(
      result,
      Some("--lynx-display-toggle:var(--lynx-display-linear); --lynx-display:linear; display:flex")
    );
  }

  #[test]
  fn test_replace_rule_display_linear_at_mid() {
    let source = "height:1px;display:linear".as_bytes();
    let source: Vec<u16> = source.iter().map(|&b| b as u16).collect();
    let offset = "height:1px;".len();
    let name_start = offset;
    let name_end = offset + 7;
    let value_start = offset + 8;
    let value_end = source.len();
    let result = get_replace_rule_value!(
      &source,
      name_start,
      name_end,
      &source,
      value_start,
      value_end
    );
    assert_eq!(
      result,
      Some("--lynx-display-toggle:var(--lynx-display-linear); --lynx-display:linear; display:flex")
    );
  }

  // #[test]
  // fn test_replace_rule_display_linear_important() {
  //   let source = "display:linear ;".as_bytes();
  //   let source: Vec<u16> = source.iter().map(|&b| b as u16).collect();
  //   let name_start = 0;
  //   let name_end = 7;
  //   let value_start = 8;
  //   let value_end = source.len();
  //   let result = get_replace_rule_value!(
  //     &source,
  //     name_start,
  //     name_end,
  //     &source,
  //     value_start,
  //     value_end
  //   );
  //   assert_eq!(
  //     result,
  //     Some("--lynx-display-toggle:var(--lynx-display-linear) !important; --lynx-display:linear !important; display:flex !important")
  //   );
  // }

  #[test]
  fn test_rename_rule_not_exist() {
    let source = "background-image:url(\"https://example.com\")".as_bytes();
    let source: Vec<u16> = source.iter().map(|&b| b as u16).collect();
    let name_start = 0;
    let name_end = "background-image".len();
    let result = get_rename_rule_value!(&source, name_start, name_end);
    assert_eq!(result, None);
  }

  #[test]
  fn test_replace_rule_value_not_match() {
    let source = "display:grid".as_bytes();
    let source: Vec<u16> = source.iter().map(|&b| b as u16).collect();
    let name_start = 0;
    let name_end = 7;
    let value_start = 8;
    let value_end = source.len();
    let result = get_replace_rule_value!(
      &source,
      name_start,
      name_end,
      &source,
      value_start,
      value_end
    );
    assert_eq!(result, None);
  }

  #[test]
  fn test_replace_rule_name_not_match() {
    let source = "height:1px".as_bytes();
    let source: Vec<u16> = source.iter().map(|&b| b as u16).collect();
    let name_start = 0;
    let name_end = 6;
    let value_start = 7;
    let value_end = source.len();
    let result = get_replace_rule_value!(
      &source,
      name_start,
      name_end,
      &source,
      value_start,
      value_end
    );
    assert_eq!(result, None);
  }
}
