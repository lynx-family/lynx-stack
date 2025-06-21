import type { CSSProperties } from '@lynx-js/types';

/**
 * @public
 *
 * Longhand css properties that are supported by Lynx
 *
 * TODO: remove this after https://github.com/lynx-family/lynx/pull/1190 is published
 */
export type LonghandProperties = [
  'top',
  'borderTopColor',
  'backgroundOrigin',
  'backgroundRepeat',
  'backgroundSize',
  'visibility',
  'borderBottomColor',
  'transitionProperty',
  'transitionDuration',
  'transitionDelay',
  'transitionTimingFunction',
  'content',
  'borderLeftStyle',
  'borderRightStyle',
  'borderTopStyle',
  'borderBottomStyle',
  'implicitAnimation',
  'overflowX',
  'overflowY',
  'wordBreak',
  'backgroundClip',
  'outlineColor',
  'outlineStyle',
  'outlineWidth',
  'verticalAlign',
  'caretColor',
  'borderTopLeftRadius',
  'direction',
  'relativeId',
  'relativeAlignTop',
  'relativeAlignRight',
  'relativeAlignBottom',
  'relativeAlignLeft',
  'relativeTopOf',
  'relativeRightOf',
  'relativeBottomOf',
  'relativeLeftOf',
  'borderBottomLeftRadius',
  'relativeLayoutOnce',
  'relativeCenter',
  'enterTransitionName',
  'exitTransitionName',
  'pauseTransitionName',
  'resumeTransitionName',
  'zIndex',
  'textDecorationColor',
  'linearCrossGravity',
  'borderTopRightRadius',
  'marginInlineStart',
  'marginInlineEnd',
  'paddingInlineStart',
  'paddingInlineEnd',
  'borderInlineStartColor',
  'borderInlineEndColor',
  'borderInlineStartWidth',
  'borderInlineEndWidth',
  'borderInlineStartStyle',
  'borderInlineEndStyle',
  'borderBottomRightRadius',
  'borderStartStartRadius',
  'borderEndStartRadius',
  'borderStartEndRadius',
  'borderEndEndRadius',
  'relativeAlignInlineStart',
  'relativeAlignInlineEnd',
  'relativeInlineStartOf',
  'relativeInlineEndOf',
  'insetInlineStart',
  'insetInlineEnd',
  'maskImage',
  'gridTemplateColumns',
  'gridTemplateRows',
  'gridAutoColumns',
  'gridAutoRows',
  'gridColumnSpan',
  'gridRowSpan',
  'gridColumnStart',
  'gridColumnEnd',
  'gridRowStart',
  'borderLeftWidth',
  'gridRowEnd',
  'gridColumnGap',
  'gridRowGap',
  'justifyItems',
  'justifySelf',
  'gridAutoFlow',
  'filter',
  'listMainAxisGap',
  'listCrossAxisGap',
  'linearDirection',
  'borderRightWidth',
  'perspective',
  'cursor',
  'textIndent',
  'clipPath',
  'textStroke',
  'textStrokeWidth',
  'textStrokeColor',
  'XAutoFontSize',
  'XAutoFontSizePresetSizes',
  'left',
  'borderTopWidth',
  'maskRepeat',
  'maskPosition',
  'maskClip',
  'maskOrigin',
  'maskSize',
  'columnGap',
  'rowGap',
  'imageRendering',
  'hyphens',
  'borderBottomWidth',
  'XAppRegion',
  'XAnimationColorInterpolation',
  'XHandleSize',
  'XHandleColor',
  'offsetDistance',
  'offsetPath',
  'offsetRotate',
  'color',
  'opacity',
  'display',
  'height',
  'width',
  'maxWidth',
  'minWidth',
  'right',
  'maxHeight',
  'minHeight',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
  'marginLeft',
  'marginRight',
  'bottom',
  'marginTop',
  'marginBottom',
  'letterSpacing',
  'textAlign',
  'lineHeight',
  'textOverflow',
  'fontSize',
  'fontWeight',
  'position',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'flexDirection',
  'flexWrap',
  'alignItems',
  'alignSelf',
  'alignContent',
  'justifyContent',
  'boxSizing',
  'fontFamily',
  'fontStyle',
  'transform',
  'animationName',
  'animationDuration',
  'animationTimingFunction',
  'animationDelay',
  'animationIterationCount',
  'backgroundColor',
  'animationDirection',
  'animationFillMode',
  'animationPlayState',
  'lineSpacing',
  'order',
  'boxShadow',
  'transformOrigin',
  'linearOrientation',
  'linearWeightSum',
  'borderLeftColor',
  'linearWeight',
  'linearGravity',
  'linearLayoutGravity',
  'layoutAnimationCreateDuration',
  'layoutAnimationCreateTimingFunction',
  'layoutAnimationCreateDelay',
  'layoutAnimationCreateProperty',
  'layoutAnimationDeleteDuration',
  'layoutAnimationDeleteTimingFunction',
  'layoutAnimationDeleteDelay',
  'borderRightColor',
  'layoutAnimationDeleteProperty',
  'layoutAnimationUpdateDuration',
  'layoutAnimationUpdateTimingFunction',
  'layoutAnimationUpdateDelay',
  'adaptFontSize',
  'aspectRatio',
  'textShadow',
  'backgroundImage',
];

/**
 * @public
 *
 * Acceptable CSS properties for simple styling.
 *
 * @remarks
 *
 * This type is used to define the properties that can be used in simple styling. It is a subset of the `CSSProperties` type, and only includes the longhand properties that are supported in simple styling. Shorthand properties are not allowed in simple styling mode.
 */
export type SimpleStyleCSSProperties = Pick<
  CSSProperties,
  LonghandProperties[number] & keyof CSSProperties
>;

/**
 * @public
 *
 * The `SimpleStyleSheet` API is used to create style objects that can be used in Simple Styling mode.
 *
 * @example
 * ```tsx
 * import { SimpleStyleSheet } from '@lynx-js/react';
 *
 * const styles = SimpleStyleSheet.create({
 *   container: {
 *     backgroundColor: 'red',
 *   },
 * });
 *
 * export default function App() {
 *   return <view simpleStyle={styles.container} />;
 * }
 * ```
 *
 * @remarks
 *
 * The `SimpleStyleSheet.create` method takes a style object as its argument and returns a new style object with the same keys. It marks the style object as a simple style object, and will be consumed by the Simple Styling transformer.
 */
export const SimpleStyleSheet = {
  /**
   * @public
   *
   * Create a simple style object.
   */
  create<T extends Record<string, SimpleStyleCSSProperties | ((...args: any[]) => SimpleStyleCSSProperties)>>(
    styleSheet: T,
  ): T {
    if (__DEV__) {
      return styleSheet;
    }
    throw new Error(
      `\`SimpleStyleSheet.create\` is only supported in Simple Styling mode, please enable Simple Styling by set \`enableSimpleStyling: true\` in pluginReactLynx`,
    );
  },
};
