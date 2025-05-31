#ifndef HANDLE_DECLARATION_H
#define HANDLE_DECLARATION_H
#include <stdint.h>
#include <stddef.h>
#include "trie.h"
int32_t read_replace_rules(uint16_t* declaration_name, int32_t declaration_name_length, uint16_t* declaration_value, int32_t declaration_value_length);
int32_t read_rename_rules(uint16_t* declaration_name, int32_t declaration_name_length);
#endif