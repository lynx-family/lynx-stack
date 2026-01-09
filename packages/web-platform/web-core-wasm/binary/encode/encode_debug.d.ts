/* tslint:disable */
/* eslint-disable */
export enum LEOAsmOpcode {
  SetAttribute = 1,
  RemoveChild = 3,
  AppendChild = 5,
  CreateElement = 6,
  SetAttributeSlot = 7,
  AppendElementSlot = 8,
  SetDataset = 10,
  AddEvent = 11,
  AppendToRoot = 12,
}
export class DecodedStyleData {
  free(): void;
  [Symbol.dispose](): void;
  constructor(buffer: Uint8Array);
  query_css_og_declarations_by_css_id(css_id: number, class_name: string[]): string;
  static decode_into(buffer: Uint8Array, entry_name: string | null | undefined, config_enable_css_selector: boolean): Uint8Array;
  static encode_from_raw_style_info(raw_style_info: RawStyleInfo, config_enable_css_selector: boolean, entry_name?: string | null): Uint8Array;
  readonly style_content: string;
  readonly font_face_content: string;
}
export class ElementTemplateSection {
  free(): void;
  [Symbol.dispose](): void;
  constructor();
  static from_encoded(buffer: Uint8Array): ElementTemplateSection;
  add_element_template(id: string, raw_element_template: RawElementTemplate): void;
  encode(): Uint8Array;
}
export class Operation {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
}
export class RawElementTemplate {
  free(): void;
  [Symbol.dispose](): void;
  constructor();
  append_to_root(element_id: number): void;
  create_element(tag_names: string, element_id: number): void;
  set_attribute(element_id: number, attr_name: string, attr_value: string): void;
  set_dataset(element_id: number, data_name: string, data_value: string): void;
  append_child(parent_element_id: number, child_element_id: number): void;
  set_cross_thread_event(element_id: number, event_type: string, event_name: string, event_value: string): void;
  set_attribute_slot(element_id: number, attribute_slot_id: number, attr_name: string): void;
  append_element_slot(parent_element_id: number, child_element_slot_id: number): void;
}
/**
 *
 * * key: cssId
 * * value: StyleSheet
 * 
 */
export class RawStyleInfo {
  free(): void;
  [Symbol.dispose](): void;
  constructor();
  /**
   *
   *   * Appends an import to the stylesheet identified by `css_id`.
   *   * If the stylesheet does not exist, it is created.
   *   * @param css_id - The ID of the CSS file.
   *   * @param import_css_id - The ID of the imported CSS file.
   *   
   */
  append_import(css_id: number, import_css_id: number): void;
  /**
   *
   *   * Pushes a rule to the stylesheet identified by `css_id`.
   *   * If the stylesheet does not exist, it is created.
   *   * @param css_id - The ID of the CSS file.
   *   * @param rule - The rule to append.
   *   
   */
  push_rule(css_id: number, rule: Rule): void;
  /**
   *
   *   * Encodes the RawStyleInfo into a Uint8Array using bincode serialization.
   *   * @returns A Uint8Array containing the serialized RawStyleInfo.
   *   
   */
  encode(): Uint8Array;
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
   *   * Sets the prelude for the rule.
   *   * @param prelude - The prelude to set (SelectorList or KeyFramesPrelude).
   *   
   */
  set_prelude(prelude: RulePrelude): void;
  /**
   *
   *   * Pushes a declaration to the rule's declaration block.
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
export class StyleInfoDecoder {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
}
