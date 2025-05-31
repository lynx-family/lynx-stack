#ifndef TOKENIZE_H
#define TOKENIZE_H
#include <emscripten.h>
#include <stdint.h>
#include "char_code_definitions.h"
#include "types.h"
#include "utils.h"
#include "../lynx-style-transform/handle_declaration.h"
void consume_numeric_token(const uint16_t* source, int32_t source_length, int32_t* offset, TokenType* type);
void consume_ident_like_token(const uint16_t* source, int32_t source_length, int32_t* offset, TokenType* type);
void consume_url_token(const uint16_t* source, int32_t source_length, int32_t* offset, TokenType* type);
void consume_string_token(const uint16_t* source, int32_t source_length, uint32_t ending_code_point, int32_t* offset, TokenType* type);
EMSCRIPTEN_KEEPALIVE
void tokenize(const uint16_t* source, int32_t source_length);
EM_JS(void, on_declaration, (int32_t start, int32_t end, int32_t replace_id, int32_t semicolon_end, bool is_important), {
    globalThis._tokenizer_on_declaration_callback(start, end, replace_id, semicolon_end, is_important);
});
#endif