/* tslint:disable */
/* eslint-disable */

export class MainThreadServerContext {
    free(): void;
    [Symbol.dispose](): void;
    add_class(element_id: number, class_name: string): void;
    add_inline_style_raw_string_key(element_id: number, key: string, value?: string | null): void;
    append_child(parent_id: number, child_id: number): void;
    create_element(tag_name: string, parent_component_unique_id?: number | null, component_css_id_opt?: number | null, component_id?: string | null): number;
    generate_html(element_id: number): string;
    get_attribute(element_id: number, key: string): string | undefined;
    get_attributes(element_id: number): object;
    get_page_css(): string;
    get_parent(child_id: number): number | undefined;
    get_tag(element_id: number): string | undefined;
    insert_before(parent_id: number, child_id: number, ref_id?: number | null): void;
    constructor(view_attributes: string, enable_css_selector: boolean, transform_vw: boolean, transform_vh: boolean, transform_rem: boolean);
    push_style_sheet(resource: StyleSheetResource, entry_name?: string | null): void;
    remove_attribute(element_id: number, key: string): void;
    remove_child(parent_id: number, child_id: number): void;
    replace_element(new_child_id: number, old_child_id: number): void;
    replace_elements(parent_id: number, new_children_ids: Uint32Array, old_children_ids: Uint32Array): void;
    set_attribute(element_id: number, key: string, value: string): void;
    set_css_id(elements_unique_id: Uint32Array, css_id: number, entry_name?: string | null): void;
    set_inline_styles_in_key_value_vec(element_id: number, k_v_vec: string[]): void;
    set_inline_styles_in_str(element_id: number, styles: string): boolean;
    set_inline_styles_number_key(element_id: number, key: number, value?: string | null): void;
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
    /**
     * Builds a resource straight from a [`RawStyleInfo`], with no rkyv step.
     *
     * The bundle path pays for two rkyv passes over the style data: the decode
     * worker serialises the [`DecodedStyleData`] it just produced
     * (`encode_legacy_json_generated_raw_style_info`) only so that the bytes can
     * cross into the main thread, which immediately deserialises them again in
     * [`StyleSheetResource::new`]. Neither pass carries information - they exist
     * solely because the two halves live in different wasm instances.
     *
     * A caller already running on the main thread, in the same instance that will
     * own the resource, has no such boundary to cross. It can hand the
     * `RawStyleInfo` over directly and skip both passes. That is what this entry
     * is for: the buildless markup path builds its `RawStyleInfo` on the main
     * thread and never produces bundle bytes at all.
     *
     * Equivalence with the bundle path is structural rather than asserted: both
     * run the same [`StyleInfoDecoder`] over the same input and then the same
     * [`Self::from_decoded_style_data`]. The only difference is whether the
     * `DecodedStyleData` in between is round-tripped through rkyv or handed over
     * in memory.
     *
     * Deliberately a new entry point rather than a change to
     * `encode_legacy_json_generated_raw_style_info`, which every ReactLynx card's
     * JSON artifact goes through and whose behaviour must not move.
     */
    static fromRawStyleInfo(raw_style_info: RawStyleInfo, _document: any, config_enable_css_selector: boolean, entry_name: string | null | undefined, transform_vw: boolean, transform_vh: boolean, transform_rem: boolean): StyleSheetResource;
    /**
     * Builds a resource from an rkyv-encoded [`DecodedStyleData`].
     *
     * This is the bundle path's entry point: the decode worker produces those
     * bytes and they cross `postMessage` to get here, because a wasm object
     * cannot be structured-cloned.
     */
    constructor(buffer: Uint8Array, _document: any);
}

export function decode_style_info(buffer: Uint8Array, entry_name: string | null | undefined, config_enable_css_selector: boolean, transform_vw: boolean, transform_vh: boolean, transform_rem: boolean): Uint8Array;

export function encode_legacy_json_generated_raw_style_info(raw_style_info: RawStyleInfo, config_enable_css_selector: boolean, entry_name: string | null | undefined, transform_vw: boolean, transform_vh: boolean, transform_rem: boolean): Uint8Array;

export function get_font_face_content(buffer: Uint8Array): string;

export function get_style_content(buffer: Uint8Array): string;

export function init_server_in_shadow_css(css: string): void;
