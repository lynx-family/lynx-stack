/* tslint:disable */
/* eslint-disable */

export class MainThreadServerContext {
    free(): void;
    [Symbol.dispose](): void;
    append_child(parent_id: number, child_id: number): void;
    create_element(tag_name: string): number;
    generate_html_segment(element_id: number): string;
    get_page_css(): string;
    constructor();
    push_style_sheet(resource: StyleSheetResource, entry_name?: string | null): void;
    set_attribute(element_id: number, key: string, value: string): void;
    set_style(element_id: number, key: string, value: string): void;
    update_css_og_style(unique_id: number, css_id: number, class_names: string[], entry_name?: string | null): void;
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

export function decode_style_info(buffer: Uint8Array, entry_name: string | null | undefined, config_enable_css_selector: boolean): Uint8Array;

export function encode_legacy_json_generated_raw_style_info(raw_style_info: RawStyleInfo, config_enable_css_selector: boolean, entry_name?: string | null): Uint8Array;

export function get_font_face_content(buffer: Uint8Array): string;

export function get_style_content(buffer: Uint8Array): string;
