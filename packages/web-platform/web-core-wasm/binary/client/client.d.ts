/* tslint:disable */
/* eslint-disable */

/**
 *
 * * for return of __GetEvents
 *
 */
export class EventInfo {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    event_handler: any;
    event_name: string;
    event_type: string;
}

export class MainThreadWasmContext {
    free(): void;
    [Symbol.dispose](): void;
    add_cross_thread_event(unique_id: number, event_type: string, event_name: string, event_handler_identifier?: string | null): void;
    add_dataset(unique_id: number, key: any, value: any): void;
    add_run_worklet_event(unique_id: number, event_type: string, event_name: string, event_handler_identifier?: any | null): void;
    common_event_handler(event: any, bubble_unique_id_path: Uint32Array, event_name: string): void;
    create_element_common(parent_component_unique_id: number, dom: HTMLElement, css_id?: number | null, component_id?: string | null): number;
    dispatch_event_by_path(bubble_unique_id_path: Uint32Array, event_name: string, is_capture: boolean, serialized_event: any): boolean;
    get_component_id(unique_id: number): string | undefined;
    get_config(unique_id: number): object;
    get_css_id_by_unique_id(unique_id: number): number | undefined;
    get_data_by_key(unique_id: number, key: string): any;
    get_dataset(unique_id: number): object;
    get_dom_by_unique_id(unique_id: number): HTMLElement | undefined;
    get_element_config(unique_id: number): object | undefined;
    get_event(unique_id: number, event_name: string, event_type: string): any;
    get_events(unique_id: number): EventInfo[];
    get_unique_id_by_component_id(component_id: string): number | undefined;
    constructor(root_node: Node, mts_binding: any, config_enable_css_selector: boolean);
    push_style_sheet(style_info: StyleSheetResource, entry_name?: string | null): void;
    /**
     *
     *   * key: String
     *   * value: stringifyed js value
     *
     */
    set_config(unique_id: number, config: object): void;
    set_css_id(elements_unique_id: Uint32Array, css_id: number, entry_name?: string | null): void;
    set_dataset(unique_id: number, dom: HTMLElement, new_dataset: object): void;
    set_page_element_unique_id(unique_id: number): void;
    take_timing_flags(): string[];
    update_component_id(unique_id: number, component_id?: string | null): void;
    update_css_og_style(unique_id: number, entry_name?: string | null): void;
}

export class RawStyleInfo {
    free(): void;
    [Symbol.dispose](): void;
    /**
     *
     *   * Appends an import to the stylesheet identified by `css_id`.
     *   * If the stylesheet does not exist, it is created.
     *   * @param css_id - The ID of the CSS file.
     *   * @param import_css_id - The ID of the imported CSS file.
     *
     */
    append_import(css_id: number, import_css_id: number): void;
    constructor();
    /**
     *
     *   * Pushes a rule to the stylesheet identified by `css_id`.
     *   * If the stylesheet does not exist, it is created.
     *   * @param css_id - The ID of the CSS file.
     *   * @param rule - The rule to append.
     *
     */
    push_rule(css_id: number, rule: Rule): void;
}

export class Rule {
    free(): void;
    [Symbol.dispose](): void;
    /**
     *
     *   * Creates a new Rule with the specified type.
     *   * @param rule_type - The type of the rule (e.g., "StyleRule", "FontFaceRule", "KeyframesRule").
     *
     */
    constructor(rule_type: string);
    /**
     *
     *   * Pushes a declaration to the rule's declaration block.
     *   * LynxJS doesn't support !important
     *   * @param property_name - The property name.
     *   * @param value - The property value.
     *
     */
    push_declaration(property_name: string, value: string): void;
    /**
     *
     *   * Pushes a nested rule to the rule.
     *   * @param rule - The nested rule to add.
     *
     */
    push_rule_children(rule: Rule): void;
    /**
     *
     *   * Sets the prelude for the rule.
     *   * @param prelude - The prelude to set (SelectorList or KeyFramesPrelude).
     *
     */
    set_prelude(prelude: RulePrelude): void;
}

/**
 *
 * * Either SelectorList or KeyFramesPrelude
 * * Depending on the RuleType
 * * If it is SelectorList, then selectors is a list of Selector
 * * If it is KeyFramesPrelude, then selectors has only one selector which is Prelude text, its simple_selectors is empty
 * * If the parent is FontFace, then selectors is empty
 *
 */
export class RulePrelude {
    free(): void;
    [Symbol.dispose](): void;
    constructor();
    /**
     *
     *   * Pushes a selector to the list.
     *   * @param selector - The selector to add.
     *
     */
    push_selector(selector: Selector): void;
}

export class Selector {
    free(): void;
    [Symbol.dispose](): void;
    constructor();
    /**
     *
     *   * Pushes a selector section to the selector.
     *   * @param selector_type - The type of the selector section (e.g., "ClassSelector", "IdSelector").
     *   * @param value - The value of the selector section.
     *
     */
    push_one_selector_section(selector_type: string, value: string): void;
}

export class StyleSheetResource {
    free(): void;
    [Symbol.dispose](): void;
    constructor(buffer: Uint8Array, _document: any);
}

/**
 *
 * * The key could be string or number
 * * The value could be string or number or null or undefined
 *
 */
export function add_inline_style_raw_string_key(dom: HTMLElement, key: string, value?: string | null): void;

export function decode_style_info(buffer: Uint8Array, entry_name: string | null | undefined, config_enable_css_selector: boolean): Uint8Array;

export function encode_legacy_json_generated_raw_style_info(raw_style_info: RawStyleInfo, config_enable_css_selector: boolean, entry_name?: string | null): Uint8Array;

export function get_font_face_content(buffer: Uint8Array): string;

export function get_inline_styles_in_key_value_vec(dom: HTMLElement, k_v_vec: string[]): void;

export function get_style_content(buffer: Uint8Array): string;

export function set_inline_styles_in_str(dom: HTMLElement, styles: string): boolean;

export function set_inline_styles_number_key(dom: HTMLElement, key: number, value?: string | null): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_eventinfo_free: (a: number, b: number) => void;
    readonly __wbg_get_eventinfo_event_handler: (a: number) => any;
    readonly __wbg_get_eventinfo_event_name: (a: number) => [number, number];
    readonly __wbg_get_eventinfo_event_type: (a: number) => [number, number];
    readonly __wbg_mainthreadwasmcontext_free: (a: number, b: number) => void;
    readonly __wbg_rawstyleinfo_free: (a: number, b: number) => void;
    readonly __wbg_rule_free: (a: number, b: number) => void;
    readonly __wbg_ruleprelude_free: (a: number, b: number) => void;
    readonly __wbg_selector_free: (a: number, b: number) => void;
    readonly __wbg_set_eventinfo_event_handler: (a: number, b: any) => void;
    readonly __wbg_set_eventinfo_event_name: (a: number, b: number, c: number) => void;
    readonly __wbg_set_eventinfo_event_type: (a: number, b: number, c: number) => void;
    readonly __wbg_stylesheetresource_free: (a: number, b: number) => void;
    readonly add_inline_style_raw_string_key: (a: any, b: number, c: number, d: number, e: number) => void;
    readonly decode_style_info: (a: any, b: number, c: number, d: number) => [number, number, number];
    readonly encode_legacy_json_generated_raw_style_info: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly get_font_face_content: (a: any) => [number, number, number, number];
    readonly get_inline_styles_in_key_value_vec: (a: any, b: number, c: number) => void;
    readonly get_style_content: (a: any) => [number, number, number, number];
    readonly mainthreadwasmcontext_add_cross_thread_event: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly mainthreadwasmcontext_add_dataset: (a: number, b: number, c: any, d: any) => [number, number];
    readonly mainthreadwasmcontext_add_run_worklet_event: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly mainthreadwasmcontext_common_event_handler: (a: number, b: any, c: number, d: number, e: number, f: number) => void;
    readonly mainthreadwasmcontext_create_element_common: (a: number, b: number, c: any, d: number, e: number, f: number) => number;
    readonly mainthreadwasmcontext_dispatch_event_by_path: (a: number, b: number, c: number, d: number, e: number, f: number, g: any) => number;
    readonly mainthreadwasmcontext_get_component_id: (a: number, b: number) => [number, number, number, number];
    readonly mainthreadwasmcontext_get_config: (a: number, b: number) => [number, number, number];
    readonly mainthreadwasmcontext_get_css_id_by_unique_id: (a: number, b: number) => number;
    readonly mainthreadwasmcontext_get_data_by_key: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly mainthreadwasmcontext_get_dataset: (a: number, b: number) => [number, number, number];
    readonly mainthreadwasmcontext_get_dom_by_unique_id: (a: number, b: number) => any;
    readonly mainthreadwasmcontext_get_element_config: (a: number, b: number) => [number, number, number];
    readonly mainthreadwasmcontext_get_event: (a: number, b: number, c: number, d: number, e: number, f: number) => any;
    readonly mainthreadwasmcontext_get_events: (a: number, b: number) => [number, number];
    readonly mainthreadwasmcontext_get_unique_id_by_component_id: (a: number, b: number, c: number) => number;
    readonly mainthreadwasmcontext_new: (a: any, b: any, c: number) => number;
    readonly mainthreadwasmcontext_push_style_sheet: (a: number, b: number, c: number, d: number) => [number, number];
    readonly mainthreadwasmcontext_set_config: (a: number, b: number, c: any) => [number, number];
    readonly mainthreadwasmcontext_set_css_id: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly mainthreadwasmcontext_set_dataset: (a: number, b: number, c: any, d: any) => [number, number];
    readonly mainthreadwasmcontext_set_page_element_unique_id: (a: number, b: number) => void;
    readonly mainthreadwasmcontext_take_timing_flags: (a: number) => [number, number];
    readonly mainthreadwasmcontext_update_component_id: (a: number, b: number, c: number, d: number) => [number, number];
    readonly mainthreadwasmcontext_update_css_og_style: (a: number, b: number, c: number, d: number) => [number, number];
    readonly rawstyleinfo_append_import: (a: number, b: number, c: number) => void;
    readonly rawstyleinfo_new: () => number;
    readonly rawstyleinfo_push_rule: (a: number, b: number, c: number) => void;
    readonly rule_new: (a: number, b: number) => [number, number, number];
    readonly rule_push_declaration: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly rule_push_rule_children: (a: number, b: number) => void;
    readonly rule_set_prelude: (a: number, b: number) => void;
    readonly ruleprelude_new: () => number;
    readonly ruleprelude_push_selector: (a: number, b: number) => void;
    readonly selector_push_one_selector_section: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly set_inline_styles_in_str: (a: any, b: number, c: number) => number;
    readonly set_inline_styles_number_key: (a: any, b: number, c: number, d: number) => void;
    readonly stylesheetresource_new: (a: any, b: any) => [number, number, number];
    readonly selector_new: () => number;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_drop_slice: (a: number, b: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
