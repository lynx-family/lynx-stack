#include "trie.h"

uint32_t get_trie_value(struct TrieNode node[], uint16_t* source, int32_t length) {
  for(int32_t ii = 0; ii < length; ii++) {
    uint16_t char_code = get_trie_char_code(source[ii]);
    uint32_t char_code_mask = 1 << char_code;
    struct TrieNode current_node = node[ii];
    uint32_t is_continue = current_node.char_map & char_code_mask;
    if (is_continue == 0) {
      return 0;
    }
    else if (ii == length - 1) {
      return (uint32_t)current_node.values[char_code];
    }
  }
  return 0; // No value found for the given source in the trie
}

