/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use bincode::Decode;
#[cfg(any(feature = "encode", test))]
use bincode::Encode;

use crate::css_tokenizer::tokenize;

macro_rules! define_css_properties {
    ($($variant:ident = $name:expr),* $(,)?) => {
        #[cfg_attr(any(feature = "encode", test), derive(Encode, Debug))]
        #[derive(Clone, Copy, PartialEq, Eq, Hash, Decode)]
        #[repr(u16)]
        pub enum CSSProperty {
            $($variant),*,
            Unknown,
        }

        #[cfg(any(feature = "client", test))]
        pub const STYLE_PROPERTY_MAP: &[&str] = &[
            $($name),*
        ];

        impl CSSProperty {
            #[cfg(any(feature = "client", test))]
            pub fn from_id(id: u16) -> Self {
                // We rely on the order being exactly the same as the enum variants.
                // Enum variants are assigned 0, 1, 2... by default.
                // We check if id is within bounds.
                // STYLE_PROPERTY_MAP.len() should match the number of variants (excluding Unknown).
                if (id as usize) < STYLE_PROPERTY_MAP.len() {
                    // Safety: The variants are strictly 0..N-1 matching the map indices.
                    unsafe { std::mem::transmute(id) }
                } else {
                    Self::Unknown
                }
            }

            pub fn to_string(&self) -> &'static str {
                match self {
                    $(Self::$variant => $name),*,
                    Self::Unknown => "",
                }
            }

            pub fn parse(s: &str) -> Self {
                match s {
                    $($name => Self::$variant),*,
                    _ => Self::Unknown,
                }
            }
        }
    };
}

define_css_properties! {
  /*
  * append values only, do not change the order
  */
    Empty = "",
    Src = "src",
    Top = "top",
    Left = "left",
    Right = "right",
    Bottom = "bottom",
    Position = "position",
    BoxSizing = "box-sizing",
    BackgroundColor = "background-color",
    BorderLeftColor = "border-left-color",
    BorderRightColor = "border-right-color",
    BorderTopColor = "border-top-color",
    BorderBottomColor = "border-bottom-color",
    BorderRadius = "border-radius",
    BorderTopLeftRadius = "border-top-left-radius",
    BorderBottomLeftRadius = "border-bottom-left-radius",
    BorderTopRightRadius = "border-top-right-radius",
    BorderBottomRightRadius = "border-bottom-right-radius",
    BorderWidth = "border-width",
    BorderLeftWidth = "border-left-width",
    BorderRightWidth = "border-right-width",
    BorderTopWidth = "border-top-width",
    BorderBottomWidth = "border-bottom-width",
    Color = "color",
    Opacity = "opacity",
    Display = "display",
    Overflow = "overflow",
    Height = "height",
    Width = "width",
    MaxWidth = "max-width",
    MinWidth = "min-width",
    MaxHeight = "max-height",
    MinHeight = "min-height",
    Padding = "padding",
    PaddingLeft = "padding-left",
    PaddingRight = "padding-right",
    PaddingTop = "padding-top",
    PaddingBottom = "padding-bottom",
    Margin = "margin",
    MarginLeft = "margin-left",
    MarginRight = "margin-right",
    MarginTop = "margin-top",
    MarginBottom = "margin-bottom",
    WhiteSpace = "white-space",
    LetterSpacing = "letter-spacing",
    TextAlign = "text-align",
    LineHeight = "line-height",
    TextOverflow = "text-overflow",
    FontSize = "font-size",
    FontWeight = "font-weight",
    Flex = "flex",
    FlexGrow = "flex-grow",
    FlexShrink = "flex-shrink",
    FlexBasis = "flex-basis",
    FlexDirection = "flex-direction",
    FlexWrap = "flex-wrap",
    AlignItems = "align-items",
    AlignSelf = "align-self",
    AlignContent = "align-content",
    JustifyContent = "justify-content",
    Background = "background",
    BorderColor = "border-color",
    FontFamily = "font-family",
    FontStyle = "font-style",
    Transform = "transform",
    Animation = "animation",
    AnimationName = "animation-name",
    AnimationDuration = "animation-duration",
    AnimationTimingFunction = "animation-timing-function",
    AnimationDelay = "animation-delay",
    AnimationIterationCount = "animation-iteration-count",
    AnimationDirection = "animation-direction",
    AnimationFillMode = "animation-fill-mode",
    AnimationPlayState = "animation-play-state",
    LineSpacing = "line-spacing",
    BorderStyle = "border-style",
    Order = "order",
    BoxShadow = "box-shadow",
    TransformOrigin = "transform-origin",
    LinearOrientation = "linear-orientation",
    LinearWeightSum = "linear-weight-sum",
    LinearWeight = "linear-weight",
    LinearGravity = "linear-gravity",
    LinearLayoutGravity = "linear-layout-gravity",
    LayoutAnimationCreateDuration = "layout-animation-create-duration",
    LayoutAnimationCreateTimingFunction = "layout-animation-create-timing-function",
    LayoutAnimationCreateDelay = "layout-animation-create-delay",
    LayoutAnimationCreateProperty = "layout-animation-create-property",
    LayoutAnimationDeleteDuration = "layout-animation-delete-duration",
    LayoutAnimationDeleteTimingFunction = "layout-animation-delete-timing-function",
    LayoutAnimationDeleteDelay = "layout-animation-delete-delay",
    LayoutAnimationDeleteProperty = "layout-animation-delete-property",
    LayoutAnimationUpdateDuration = "layout-animation-update-duration",
    LayoutAnimationUpdateTimingFunction = "layout-animation-update-timing-function",
    LayoutAnimationUpdateDelay = "layout-animation-update-delay",
    AdaptFontSize = "adapt-font-size",
    AspectRatio = "aspect-ratio",
    TextDecoration = "text-decoration",
    TextShadow = "text-shadow",
    BackgroundImage = "background-image",
    BackgroundPosition = "background-position",
    BackgroundOrigin = "background-origin",
    BackgroundRepeat = "background-repeat",
    BackgroundSize = "background-size",
    Border = "border",
    Visibility = "visibility",
    BorderRight = "border-right",
    BorderLeft = "border-left",
    BorderTop = "border-top",
    BorderBottom = "border-bottom",
    Transition = "transition",
    TransitionProperty = "transition-property",
    TransitionDuration = "transition-duration",
    TransitionDelay = "transition-delay",
    TransitionTimingFunction = "transition-timing-function",
    Content = "content",
    BorderLeftStyle = "border-left-style",
    BorderRightStyle = "border-right-style",
    BorderTopStyle = "border-top-style",
    BorderBottomStyle = "border-bottom-style",
    ImplicitAnimation = "implicit-animation",
    OverflowX = "overflow-x",
    OverflowY = "overflow-y",
    WordBreak = "word-break",
    BackgroundClip = "background-clip",
    Outline = "outline",
    OutlineColor = "outline-color",
    OutlineStyle = "outline-style",
    OutlineWidth = "outline-width",
    VerticalAlign = "vertical-align",
    CaretColor = "caret-color",
    Direction = "direction",
    RelativeId = "relative-id",
    RelativeAlignTop = "relative-align-top",
    RelativeAlignRight = "relative-align-right",
    RelativeAlignBottom = "relative-align-bottom",
    RelativeAlignLeft = "relative-align-left",
    RelativeTopOf = "relative-top-of",
    RelativeRightOf = "relative-right-of",
    RelativeBottomOf = "relative-bottom-of",
    RelativeLeftOf = "relative-left-of",
    RelativeLayoutOnce = "relative-layout-once",
    RelativeCenter = "relative-center",
    EnterTransitionName = "enter-transition-name",
    ExitTransitionName = "exit-transition-name",
    PauseTransitionName = "pause-transition-name",
    ResumeTransitionName = "resume-transition-name",
    FlexFlow = "flex-flow",
    ZIndex = "z-index",
    TextDecorationColor = "text-decoration-color",
    LinearCrossGravity = "linear-cross-gravity",
    MarginInlineStart = "margin-inline-start",
    MarginInlineEnd = "margin-inline-end",
    PaddingInlineStart = "padding-inline-start",
    PaddingInlineEnd = "padding-inline-end",
    BorderInlineStartColor = "border-inline-start-color",
    BorderInlineEndColor = "border-inline-end-color",
    BorderInlineStartWidth = "border-inline-start-width",
    BorderInlineEndWidth = "border-inline-end-width",
    BorderInlineStartStyle = "border-inline-start-style",
    BorderInlineEndStyle = "border-inline-end-style",
    BorderStartStartRadius = "border-start-start-radius",
    BorderEndStartRadius = "border-end-start-radius",
    BorderStartEndRadius = "border-start-end-radius",
    BorderEndEndRadius = "border-end-end-radius",
    RelativeAlignInlineStart = "relative-align-inline-start",
    RelativeAlignInlineEnd = "relative-align-inline-end",
    RelativeInlineStartOf = "relative-inline-start-of",
    RelativeInlineEndOf = "relative-inline-end-of",
    InsetInlineStart = "inset-inline-start",
    InsetInlineEnd = "inset-inline-end",
    MaskImage = "mask-image",
    GridTemplateColumns = "grid-template-columns",
    GridTemplateRows = "grid-template-rows",
    GridAutoColumns = "grid-auto-columns",
    GridAutoRows = "grid-auto-rows",
    GridColumnSpan = "grid-column-span",
    GridRowSpan = "grid-row-span",
    GridColumnStart = "grid-column-start",
    GridColumnEnd = "grid-column-end",
    GridRowStart = "grid-row-start",
    GridRowEnd = "grid-row-end",
    GridColumnGap = "grid-column-gap",
    GridRowGap = "grid-row-gap",
    JustifyItems = "justify-items",
    JustifySelf = "justify-self",
    GridAutoFlow = "grid-auto-flow",
    Filter = "filter",
    ListMainAxisGap = "list-main-axis-gap",
    ListCrossAxisGap = "list-cross-axis-gap",
    LinearDirection = "linear-direction",
    Perspective = "perspective",
    Cursor = "cursor",
    TextIndent = "text-indent",
    ClipPath = "clip-path",
    TextStroke = "text-stroke",
    TextStrokeWidth = "text-stroke-width",
    TextStrokeColor = "text-stroke-color",
    XAutoFontSize = "-x-auto-font-size",
    XAutoFontSizePresetSizes = "-x-auto-font-size-preset-sizes",
    Mask = "mask",
    MaskRepeat = "mask-repeat",
    MaskPosition = "mask-position",
    MaskClip = "mask-clip",
    MaskOrigin = "mask-origin",
    MaskSize = "mask-size",
    Gap = "gap",
    ColumnGap = "column-gap",
    RowGap = "row-gap",
    ImageRendering = "image-rendering",
    Hyphens = "hyphens",
    XAppRegion = "-x-app-region",
    XAnimationColorInterpolation = "-x-animation-color-interpolation",
    XHandleColor = "-x-handle-color",
    XHandleSize = "-x-handle-size",
    OffsetPath = "offset-path",
    OffsetDistance = "offset-distance",
}

#[cfg_attr(feature = "encode", derive(Encode))]
#[derive(Clone, Decode, PartialEq)]
pub struct ValueToken {
  pub token_type: u8,
  pub value: String,
}

#[cfg_attr(feature = "encode", derive(Encode))]
#[derive(Clone, Decode)]
pub struct ParsedDeclaration {
  pub property_id: CSSProperty,
  pub value_token_list: Vec<ValueToken>,
  pub is_important: bool,
}

impl ParsedDeclaration {
  pub fn new(property_name: String, property_value: String) -> Self {
    let property_id = CSSProperty::parse(&property_name);
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
    assert_eq!(CSSProperty::parse("display"), CSSProperty::Display);
    assert_eq!(
      CSSProperty::parse("background-color"),
      CSSProperty::BackgroundColor
    );
    assert_eq!(CSSProperty::parse("invalid-prop"), CSSProperty::Unknown);
  }

  #[test]
  fn test_css_property_to_string() {
    assert_eq!(CSSProperty::Display.to_string(), "display");
    assert_eq!(CSSProperty::Unknown.to_string(), "");
  }

  #[test]
  fn test_css_property_from_id() {
    let display_idx = STYLE_PROPERTY_MAP
      .iter()
      .position(|&s| s == "display")
      .unwrap();
    assert_eq!(
      CSSProperty::from_id(display_idx as u16),
      CSSProperty::Display
    );

    assert_eq!(
      CSSProperty::from_id(STYLE_PROPERTY_MAP.len() as u16),
      CSSProperty::Unknown
    );
  }
}
