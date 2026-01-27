/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use fnv::FnvHashMap;
use lazy_static::lazy_static;
use rkyv::{Archive, Deserialize, Serialize};

use crate::css_tokenizer::tokenize;

const STYLE_PROPERTY_MAP: &[&str] = &[
  "",
  "top",
  "left",
  "right",
  "bottom",
  "position",
  "box-sizing",
  "background-color",
  "border-left-color",
  "border-right-color",
  "border-top-color",
  "border-bottom-color",
  "border-radius",
  "border-top-left-radius",
  "border-bottom-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-width",
  "border-left-width",
  "border-right-width",
  "border-top-width",
  "border-bottom-width",
  "color",
  "opacity",
  "display",
  "overflow",
  "height",
  "width",
  "max-width",
  "min-width",
  "max-height",
  "min-height",
  "padding",
  "padding-left",
  "padding-right",
  "padding-top",
  "padding-bottom",
  "margin",
  "margin-left",
  "margin-right",
  "margin-top",
  "margin-bottom",
  "white-space",
  "letter-spacing",
  "text-align",
  "line-height",
  "text-overflow",
  "font-size",
  "font-weight",
  "flex",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "flex-direction",
  "flex-wrap",
  "align-items",
  "align-self",
  "align-content",
  "justify-content",
  "background",
  "border-color",
  "font-family",
  "font-style",
  "transform",
  "animation",
  "animation-name",
  "animation-duration",
  "animation-timing-function",
  "animation-delay",
  "animation-iteration-count",
  "animation-direction",
  "animation-fill-mode",
  "animation-play-state",
  "line-spacing",
  "border-style",
  "order",
  "box-shadow",
  "transform-origin",
  "linear-orientation",
  "linear-weight-sum",
  "linear-weight",
  "linear-gravity",
  "linear-layout-gravity",
  "layout-animation-create-duration",
  "layout-animation-create-timing-function",
  "layout-animation-create-delay",
  "layout-animation-create-property",
  "layout-animation-delete-duration",
  "layout-animation-delete-timing-function",
  "layout-animation-delete-delay",
  "layout-animation-delete-property",
  "layout-animation-update-duration",
  "layout-animation-update-timing-function",
  "layout-animation-update-delay",
  "adapt-font-size",
  "aspect-ratio",
  "text-decoration",
  "text-shadow",
  "background-image",
  "background-position",
  "background-origin",
  "background-repeat",
  "background-size",
  "border",
  "visibility",
  "border-right",
  "border-left",
  "border-top",
  "border-bottom",
  "transition",
  "transition-property",
  "transition-duration",
  "transition-delay",
  "transition-timing-function",
  "content",
  "border-left-style",
  "border-right-style",
  "border-top-style",
  "border-bottom-style",
  "implicit-animation",
  "overflow-x",
  "overflow-y",
  "word-break",
  "background-clip",
  "outline",
  "outline-color",
  "outline-style",
  "outline-width",
  "vertical-align",
  "caret-color",
  "direction",
  "relative-id",
  "relative-align-top",
  "relative-align-right",
  "relative-align-bottom",
  "relative-align-left",
  "relative-top-of",
  "relative-right-of",
  "relative-bottom-of",
  "relative-left-of",
  "relative-layout-once",
  "relative-center",
  "enter-transition-name",
  "exit-transition-name",
  "pause-transition-name",
  "resume-transition-name",
  "flex-flow",
  "z-index",
  "text-decoration-color",
  "linear-cross-gravity",
  "margin-inline-start",
  "margin-inline-end",
  "padding-inline-start",
  "padding-inline-end",
  "border-inline-start-color",
  "border-inline-end-color",
  "border-inline-start-width",
  "border-inline-end-width",
  "border-inline-start-style",
  "border-inline-end-style",
  "border-start-start-radius",
  "border-end-start-radius",
  "border-start-end-radius",
  "border-end-end-radius",
  "relative-align-inline-start",
  "relative-align-inline-end",
  "relative-inline-start-of",
  "relative-inline-end-of",
  "inset-inline-start",
  "inset-inline-end",
  "mask-image",
  "grid-template-columns",
  "grid-template-rows",
  "grid-auto-columns",
  "grid-auto-rows",
  "grid-column-span",
  "grid-row-span",
  "grid-column-start",
  "grid-column-end",
  "grid-row-start",
  "grid-row-end",
  "grid-column-gap",
  "grid-row-gap",
  "justify-items",
  "justify-self",
  "grid-auto-flow",
  "filter",
  "list-main-axis-gap",
  "list-cross-axis-gap",
  "linear-direction",
  "perspective",
  "cursor",
  "text-indent",
  "clip-path",
  "text-stroke",
  "text-stroke-width",
  "text-stroke-color",
  "-x-auto-font-size",
  "-x-auto-font-size-preset-sizes",
  "mask",
  "mask-repeat",
  "mask-position",
  "mask-clip",
  "mask-origin",
  "mask-size",
  "gap",
  "column-gap",
  "row-gap",
  "image-rendering",
  "hyphens",
  "-x-app-region",
  "-x-animation-color-interpolation",
  "-x-handle-color",
  "-x-handle-size",
  "offset-path",
  "offset-distance",
];

lazy_static! {
  static ref STYLE_PROPERTY_NAME_MAP: FnvHashMap<&'static str, usize> = {
    let mut map = FnvHashMap::default();
    for (i, name) in STYLE_PROPERTY_MAP.iter().enumerate() {
      map.insert(*name, i);
    }
    map
  };
}

#[repr(u32)]
#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash, Archive, Serialize, Deserialize)]
pub enum CSSPropertyEnum {
  Unknown = 0,
  Top = 1,
  Left = 2,
  Right = 3,
  Bottom = 4,
  Position = 5,
  BoxSizing = 6,
  BackgroundColor = 7,
  BorderLeftColor = 8,
  BorderRightColor = 9,
  BorderTopColor = 10,
  BorderBottomColor = 11,
  BorderRadius = 12,
  BorderTopLeftRadius = 13,
  BorderBottomLeftRadius = 14,
  BorderTopRightRadius = 15,
  BorderBottomRightRadius = 16,
  BorderWidth = 17,
  BorderLeftWidth = 18,
  BorderRightWidth = 19,
  BorderTopWidth = 20,
  BorderBottomWidth = 21,
  Color = 22,
  Opacity = 23,
  Display = 24,
  Overflow = 25,
  Height = 26,
  Width = 27,
  MaxWidth = 28,
  MinWidth = 29,
  MaxHeight = 30,
  MinHeight = 31,
  Padding = 32,
  PaddingLeft = 33,
  PaddingRight = 34,
  PaddingTop = 35,
  PaddingBottom = 36,
  Margin = 37,
  MarginLeft = 38,
  MarginRight = 39,
  MarginTop = 40,
  MarginBottom = 41,
  WhiteSpace = 42,
  LetterSpacing = 43,
  TextAlign = 44,
  LineHeight = 45,
  TextOverflow = 46,
  FontSize = 47,
  FontWeight = 48,
  Flex = 49,
  FlexGrow = 50,
  FlexShrink = 51,
  FlexBasis = 52,
  FlexDirection = 53,
  FlexWrap = 54,
  AlignItems = 55,
  AlignSelf = 56,
  AlignContent = 57,
  JustifyContent = 58,
  Background = 59,
  BorderColor = 60,
  FontFamily = 61,
  FontStyle = 62,
  Transform = 63,
  Animation = 64,
  AnimationName = 65,
  AnimationDuration = 66,
  AnimationTimingFunction = 67,
  AnimationDelay = 68,
  AnimationIterationCount = 69,
  AnimationDirection = 70,
  AnimationFillMode = 71,
  AnimationPlayState = 72,
  LineSpacing = 73,
  BorderStyle = 74,
  Order = 75,
  BoxShadow = 76,
  TransformOrigin = 77,
  LinearOrientation = 78,
  LinearWeightSum = 79,
  LinearWeight = 80,
  LinearGravity = 81,
  LinearLayoutGravity = 82,
  LayoutAnimationCreateDuration = 83,
  LayoutAnimationCreateTimingFunction = 84,
  LayoutAnimationCreateDelay = 85,
  LayoutAnimationCreateProperty = 86,
  LayoutAnimationDeleteDuration = 87,
  LayoutAnimationDeleteTimingFunction = 88,
  LayoutAnimationDeleteDelay = 89,
  LayoutAnimationDeleteProperty = 90,
  LayoutAnimationUpdateDuration = 91,
  LayoutAnimationUpdateTimingFunction = 92,
  LayoutAnimationUpdateDelay = 93,
  AdaptFontSize = 94,
  AspectRatio = 95,
  TextDecoration = 96,
  TextShadow = 97,
  BackgroundImage = 98,
  BackgroundPosition = 99,
  BackgroundOrigin = 100,
  BackgroundRepeat = 101,
  BackgroundSize = 102,
  Border = 103,
  Visibility = 104,
  BorderRight = 105,
  BorderLeft = 106,
  BorderTop = 107,
  BorderBottom = 108,
  Transition = 109,
  TransitionProperty = 110,
  TransitionDuration = 111,
  TransitionDelay = 112,
  TransitionTimingFunction = 113,
  Content = 114,
  BorderLeftStyle = 115,
  BorderRightStyle = 116,
  BorderTopStyle = 117,
  BorderBottomStyle = 118,
  ImplicitAnimation = 119,
  OverflowX = 120,
  OverflowY = 121,
  WordBreak = 122,
  BackgroundClip = 123,
  Outline = 124,
  OutlineColor = 125,
  OutlineStyle = 126,
  OutlineWidth = 127,
  VerticalAlign = 128,
  CaretColor = 129,
  Direction = 130,
  RelativeId = 131,
  RelativeAlignTop = 132,
  RelativeAlignRight = 133,
  RelativeAlignBottom = 134,
  RelativeAlignLeft = 135,
  RelativeToTop = 136,
  RelativeToRight = 137,
  RelativeToBottom = 138,
  RelativeToLeft = 139,
  RelativeToLayoutOnce = 140,
  RelativeToCenter = 141,
  EnterTransitionName = 142,
  ExitTransitionName = 143,
  PauseTransitionName = 144,
  ResumeTransitionName = 145,
  FlexFlow = 146,
  ZIndex = 147,
  TextDecorationColor = 148,
  LinearCrossGravity = 149,
  MarginInlineStart = 150,
  MarginInlineEnd = 151,
  PaddingInlineStart = 152,
  PaddingInlineEnd = 153,
  BorderInlineStartColor = 154,
  BorderInlineEndColor = 155,
  BorderInlineStartWidth = 156,
  BorderInlineEndWidth = 157,
  BorderInlineStartStyle = 158,
  BorderInlineEndStyle = 159,
  BorderStartStartRadius = 160,
  BorderEndStartRadius = 161,
  BorderStartEndRadius = 162,
  BorderEndEndRadius = 163,
  RelativeToAlignInlineStart = 164,
  RelativeToAlignInlineEnd = 165,
  RelativeToInlineStartOf = 166,
  RelativeToInlineEndOf = 167,
  InsetInlineStart = 168,
  InsetInlineEnd = 169,
  MaskImage = 170,
  GridTemplateColumns = 171,
  GridTemplateRows = 172,
  GridAutoColumns = 173,
  GridAutoRows = 174,
  GridColumnSpan = 175,
  GridRowSpan = 176,
  GridColumnStart = 177,
  GridColumnEnd = 178,
  GridRowStart = 179,
  GridRowEnd = 180,
  GridColumnGap = 181,
  GridRowGap = 182,
  JustifyItems = 183,
  JustifySelf = 184,
  GridAutoFlow = 185,
  Filter = 186,
  ListMainAxisGap = 187,
  ListCrossAxisGap = 188,
  LinearDirection = 189,
  Perspective = 190,
  Cursor = 191,
  TextIndent = 192,
  ClipPath = 193,
  TextStroke = 194,
  TextStrokeWidth = 195,
  TextStrokeColor = 196,
  XAutoFontSize = 197,
  XAutoFontSizePresetSizes = 198,
  Mask = 199,
  MaskRepeat = 200,
  MaskPosition = 201,
  MaskClip = 202,
  MaskOrigin = 203,
  MaskSize = 204,
  Gap = 205,
  ColumnGap = 206,
  RowGap = 207,
  ImageRendering = 208,
  Hyphens = 209,
  XAppRegion = 210,
  XAnimationColorInterpolation = 211,
  XHandleColor = 212,
  XHandleSize = 213,
  OffsetPath = 214,
  OffsetDistance = 215,
}

impl CSSPropertyEnum {
  pub fn from_id(id: usize) -> Self {
    if id <= CSSPropertyEnum::OffsetDistance as usize {
      unsafe { std::mem::transmute(id as u32) }
    } else {
      CSSPropertyEnum::Unknown
    }
  }
}

#[derive(Debug, Clone, PartialEq, Eq, Archive, Serialize, Deserialize)]
pub struct CSSProperty {
  pub id: CSSPropertyEnum,
  pub unknown_name: Option<String>,
}
impl From<&str> for CSSProperty {
  fn from(s: &str) -> Self {
    let id = *STYLE_PROPERTY_NAME_MAP
      .get(s)
      .unwrap_or(&(CSSPropertyEnum::Unknown as usize));
    let property_enum = CSSPropertyEnum::from_id(id);
    Self {
      id: property_enum,
      unknown_name: if property_enum == CSSPropertyEnum::Unknown {
        Some(s.to_string())
      } else {
        None
      },
    }
  }
}

impl From<String> for CSSProperty {
  fn from(s: String) -> Self {
    let id = *STYLE_PROPERTY_NAME_MAP
      .get(s.as_str())
      .unwrap_or(&(CSSPropertyEnum::Unknown as usize));
    let property_enum = CSSPropertyEnum::from_id(id);
    Self {
      id: property_enum,
      unknown_name: if property_enum == CSSPropertyEnum::Unknown {
        Some(s)
      } else {
        None
      },
    }
  }
}

impl<'a> From<std::borrow::Cow<'a, str>> for CSSProperty {
  fn from(s: std::borrow::Cow<'a, str>) -> Self {
    match s {
      std::borrow::Cow::Borrowed(s) => s.into(),
      std::borrow::Cow::Owned(s) => s.into(),
    }
  }
}

impl From<usize> for CSSProperty {
  fn from(id: usize) -> Self {
    Self {
      id: CSSPropertyEnum::from_id(id),
      unknown_name: None,
    }
  }
}

impl From<CSSProperty> for usize {
  fn from(value: CSSProperty) -> Self {
    value.id as usize
  }
}

impl From<CSSPropertyEnum> for CSSProperty {
  fn from(id: CSSPropertyEnum) -> Self {
    Self {
      id,
      unknown_name: None,
    }
  }
}

impl std::hash::Hash for CSSProperty {
  fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
    self.id.hash(state);
  }
}

impl std::fmt::Display for CSSProperty {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    if self.id == CSSPropertyEnum::Unknown {
      write!(f, "{}", self.unknown_name.as_deref().unwrap_or(""))
    } else {
      write!(
        f,
        "{}",
        STYLE_PROPERTY_MAP
          .get(self.id as usize)
          .copied()
          .unwrap_or("")
      )
    }
  }
}

#[derive(Clone, PartialEq, Archive, Serialize, Deserialize)]
pub struct ValueToken {
  pub token_type: u8,
  pub value: String,
}

#[derive(Clone, Archive, Serialize, Deserialize)]
pub struct ParsedDeclaration {
  pub property_id: CSSProperty,
  pub value_token_list: Vec<ValueToken>,
  pub is_important: bool,
}

impl ParsedDeclaration {
  pub fn new(property_name: String, property_value: String) -> Self {
    let property_id: CSSProperty = property_name.into();
    let mut self_entity = Self {
      property_id,
      value_token_list: vec![],
      is_important: false,
    };
    tokenize::tokenize(&property_value, &mut self_entity);
    self_entity
  }
}

impl tokenize::Parser for ParsedDeclaration {
  fn on_token(&mut self, token_type: u8, token_value: &str) {
    let value_token = ValueToken {
      token_type,
      value: token_value.to_string(),
    };
    self.value_token_list.push(value_token);
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_css_property_parse() {
    assert_eq!(
      CSSProperty::from("display"),
      CSSProperty::from(CSSPropertyEnum::Display)
    );
    assert_eq!(
      CSSProperty::from("background-color"),
      CSSPropertyEnum::BackgroundColor.into()
    );
    let invalid = CSSProperty::from("invalid-prop");
    assert_eq!(invalid.id, CSSPropertyEnum::Unknown);
    assert_eq!(invalid.unknown_name, Some("invalid-prop".to_string()));
  }

  #[test]
  fn test_css_property_to_string() {
    assert_eq!(
      CSSProperty::from(CSSPropertyEnum::Display).to_string(),
      "display"
    );
    assert_eq!(CSSProperty::from(CSSPropertyEnum::Unknown).to_string(), "");
  }

  #[test]
  fn test_css_property_from_id() {
    let display_idx = STYLE_PROPERTY_MAP
      .iter()
      .position(|&s| s == "display")
      .unwrap();
    assert_eq!(display_idx, CSSPropertyEnum::Display as usize);

    assert_eq!(
      CSSProperty::from(9999),
      CSSProperty::from(CSSPropertyEnum::Unknown)
    );
  }

  #[test]
  fn test_css_property_hash() {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    fn calculate_hash<T: Hash>(t: &T) -> u64 {
      let mut s = DefaultHasher::new();
      t.hash(&mut s);
      s.finish()
    }

    let p1 = CSSProperty::from(CSSPropertyEnum::Unknown);
    let p2 = CSSProperty::from(CSSPropertyEnum::Unknown);
    let p3 = CSSProperty::from(CSSPropertyEnum::Display);

    // User requirement: hash based on numeric id only.
    // For Unknown, the ID is uniform (unknown property ID).
    assert_eq!(calculate_hash(&p1), calculate_hash(&p2));
    assert_ne!(calculate_hash(&p1), calculate_hash(&p3));

    // Also verify IDs matches
    assert_eq!(usize::from(p1.clone()), usize::from(p2));
    assert_ne!(usize::from(p1), usize::from(p3));
  }

  #[test]
  fn test_css_property_from_cow() {
    use std::borrow::Cow;
    let borrowed: Cow<str> = Cow::Borrowed("display");
    assert_eq!(CSSProperty::from(borrowed).id, CSSPropertyEnum::Display);

    let owned: Cow<str> = Cow::Owned("unknown-prop".to_string());
    let prop = CSSProperty::from(owned);
    assert_eq!(prop.id, CSSPropertyEnum::Unknown);
    assert_eq!(prop.unknown_name.as_deref(), Some("unknown-prop"));

    let src_prop = CSSProperty::from("src");
    assert_eq!(src_prop.id, CSSPropertyEnum::Unknown);
    assert_eq!(src_prop.to_string(), "src");
  }
}
