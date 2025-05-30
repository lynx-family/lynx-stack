#include "handle_declaration.h"
#include "../../tmp/replace-rule-trie.h"
#include "trie.h"

int32_t read_replace_rules(uint16_t* declaration_name, int32_t declaration_name_length, uint16_t* declaration_value, int32_t declaration_value_length) {
  struct TrieNode* value_trie = (struct TrieNode*)get_trie_value(replace_rule_trie, declaration_name, declaration_name_length);
  if (value_trie != 0) {
    return get_trie_value(value_trie, declaration_value, declaration_value_length);
  };
  return 0; // No replacement rule found
}


int32_t read_rename_rules(uint16_t* declaration_name, int32_t declaration_name_length) {
  return get_trie_value(rename_rule_trie, declaration_name, declaration_name_length);
}

