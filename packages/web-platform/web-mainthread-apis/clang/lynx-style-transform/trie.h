#ifndef TRIE_H
#define TRIE_H
#include <stdint.h>
#include <stddef.h>
#define char_code_a (uint16_t)'a'
#define char_code_z (uint16_t)'z'
#define char_code_A (uint16_t)'A'
#define char_code_Z (uint16_t)'Z'
#define char_code_othres 26

#define get_trie_char_code(code) (code >= char_code_a && code <= char_code_z) \
                                    ? (code - char_code_a) \
                                    : (code >= char_code_A && code <= char_code_Z) \
                                      ? (code - char_code_A) \
                                      : char_code_othres

struct TrieNode { 
  /* 
    Use bit 0 to 27 to show if there may be a key in current position
    0 - 26 for a - z and A-Z
    27 for all other characters
  */
  uint32_t char_map;
  uint32_t values[27];
};


uint32_t get_trie_value(struct TrieNode node[], uint16_t* source, int32_t length);
#endif