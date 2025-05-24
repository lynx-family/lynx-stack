#ifndef TOKENIZE_H
#define TOKENIZE_H
#include <emscripten.h>
#include <stdint.h>
#include "char_code_definitions.h"
#include "types.h"
#include "utils.h"
void consume_numeric_token(const uint16_t* source, int32_t source_length, int32_t* offset, TokenType* type);
void consume_ident_like_token(const uint16_t* source, int32_t source_length, int32_t* offset, TokenType* type);
void consume_url_token(const uint16_t* source, int32_t source_length, int32_t* offset, TokenType* type);
void consume_string_token(const uint16_t* source, int32_t source_length, uint32_t ending_code_point, int32_t* offset, TokenType* type);
EMSCRIPTEN_KEEPALIVE
void tokenize(const uint16_t* source, int32_t source_length);
EM_JS(void, on_declaration, (int32_t declaration_name_start,int32_t declaration_name_end,int32_t declaration_value_start,int32_t declaration_value_end, bool is_important), {
    globalThis._tokenizer_on_declaration_callback(declaration_name_start, declaration_name_end, declaration_value_start, declaration_value_end, is_important);
});
#endif