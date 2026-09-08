# Tailwind CSS v3 Utility Support

## Scope

`@lynx-js/tailwind-preset` targets Tailwind CSS v3 and adapts utility generation
to the CSS capabilities available in Lynx. This matrix follows the
[Tailwind CSS v3 documentation sidebar][installation] and records a support
decision for each utility family. Tailwind CLI output provides the evidence for
these decisions; browser CSS support is outside this matrix's scope.

## Matrix Conventions

Each status describes the capability supported by the preset. Supported and
partial utilities are enabled by default unless a row identifies them as
opt-in. The default compatibility baseline is OSS Lynx SDK 3.2.
Rows that require a newer SDK state that minimum version and any required
plugin configuration.

| Status      | Meaning                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Supported   | The listed class family is available for Lynx applications; known Lynx-specific details are documented in the row.                                     |
| Partial     | Some Tailwind CSS classes or values are unavailable, or the Lynx implementation has a material limitation; see the row's `Classes` and `Restrictions`. |
| Unsupported | The preset does not currently provide a supported implementation of the utility family.                                                                |

`Implementation` identifies where the generated utility comes from:

| Implementation         | Meaning                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| Core                   | The preset enables Tailwind's original core plugin.                                                      |
| Core + theme           | The preset enables Tailwind's original core plugin and adjusts its available values through `lynxTheme`. |
| Core + Lynx plugin     | Tailwind core generation is combined with a Lynx plugin replacement.                                     |
| Lynx plugin            | The preset replaces, adapts, or adds utility generation through a Lynx plugin.                           |
| Lynx plugin(s) + theme | One or more Lynx plugins use values added or constrained through `lynxTheme`.                            |
| —                      | The preset has no supported implementation.                                                              |

`Classes` lists the supported class patterns or fixed class names. Within a
pattern, `{a,b}` requires one of the listed alternatives, `{1..12}` represents
an inclusive integer range, and `<type>` represents a value of the named
semantic type resolved from the utility's theme scale or an accepted arbitrary
value. `*` represents an open value suffix when a narrower semantic type would
not add useful information. An explicit value list records the preset's
documented default values. A theme `DEFAULT` key is written as the bare class,
such as `shadow`, rather than as `shadow-DEFAULT`. Patterns with an omitted
segment or a leading negative sign are listed separately.

`Restrictions` lists unavailable values, Lynx-specific behavior, or future SDK
and opt-in requirements. `—` means there is no additional information for that
column.

Within each sidebar group, supported and partial utilities are listed first.
Unsupported utilities are listed separately with the CSS capability needed to
support them in a future Lynx CSS implementation. When that capability is
available in a newer Lynx SDK, the table states the minimum SDK version and the
remaining preset integration work.

## Layout

### Supported and Partial

| Utility                                              | Status    | Implementation | Classes                                                                                                                   | Restrictions                                                                                                                                                                                                |
| ---------------------------------------------------- | --------- | -------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Aspect Ratio][aspect-ratio]                         | Partial   | Core + theme   | `aspect-{square,video}`                                                                                                   | `aspect-auto` is unavailable.                                                                                                                                                                               |
| [Box Sizing][box-sizing]                             | Supported | Core           | `box-{border,content}`                                                                                                    | —                                                                                                                                                                                                           |
| [Display][display]                                   | Partial   | Lynx plugin    | `flex`, `grid`, `hidden`, `display-relative`, `linear`                                                                    | `block`, `inline`, `inline-{block,flex,grid,table}`, `flow-root`, `table`, `table-{caption,cell,column,column-group,footer-group,header-group,row,row-group}`, `contents`, and `list-item` are unavailable. |
| [Overflow][overflow]                                 | Partial   | Lynx plugin    | `overflow-{hidden,visible}`, `overflow-{x,y}-{hidden,visible}`                                                            | `auto`, `scroll`, and `clip` values are unavailable.                                                                                                                                                        |
| [Position][position]                                 | Partial   | Lynx plugin    | `fixed`, `absolute`, `relative`, `sticky`                                                                                 | `static` is unavailable.                                                                                                                                                                                    |
| [Top / Right / Bottom / Left][top-right-bottom-left] | Supported | Lynx plugin    | `{inset,inset-x,inset-y,top,right,bottom,left,start,end}-*`, `-{inset,inset-x,inset-y,top,right,bottom,left,start,end}-*` | `inset-*` expands to individual edge properties.                                                                                                                                                            |
| [Visibility][visibility]                             | Partial   | Lynx plugin    | `visible`, `invisible`                                                                                                    | `collapse` is unavailable.                                                                                                                                                                                  |
| [Z-Index][z-index]                                   | Partial   | Core + theme   | `z-{0,10,20,30,40,50}`, `-z-{10,20,30,40,50}`                                                                             | `z-auto` is unavailable.                                                                                                                                                                                    |

### Unsupported

| Utility                                      | Required CSS capability                                              |
| -------------------------------------------- | -------------------------------------------------------------------- |
| [Container][container]                       | Responsive max-width constraints and viewport breakpoints.           |
| [Columns][columns]                           | CSS multi-column layout (`columns`, `column-width`, `column-count`). |
| [Break After][break-after]                   | Fragmentation and break control (`break-after`).                     |
| [Break Before][break-before]                 | Fragmentation and break control (`break-before`).                    |
| [Break Inside][break-inside]                 | Fragmentation and break control (`break-inside`).                    |
| [Box Decoration Break][box-decoration-break] | Fragmented inline box decoration (`box-decoration-break`).           |
| [Floats][float]                              | Float layout and text wrapping around floated boxes.                 |
| [Clear][clear]                               | Float clearance.                                                     |
| [Isolation][isolation]                       | Stacking-context isolation (`isolation: isolate`).                   |
| [Object Fit][object-fit]                     | Replaced-element sizing and `object-fit`.                            |
| [Object Position][object-position]           | Replaced-element positioning and `object-position`.                  |
| [Overscroll Behavior][overscroll-behavior]   | Scroll chaining control (`overscroll-behavior`).                     |

## Flexbox and Grid

### Supported and Partial

| Utility                                        | Status    | Implementation     | Classes                                                                                  | Restrictions                                                                                                                                            |
| ---------------------------------------------- | --------- | ------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Flex Basis][flex-basis]                       | Supported | Core               | `basis-*`                                                                                | —                                                                                                                                                       |
| [Flex Direction][flex-direction]               | Supported | Core               | `flex-{row,row-reverse,col,col-reverse}`                                                 | —                                                                                                                                                       |
| [Flex Wrap][flex-wrap]                         | Supported | Core               | `flex-{wrap,wrap-reverse,nowrap}`                                                        | —                                                                                                                                                       |
| [Flex][flex]                                   | Supported | Core               | `flex-{1,auto,initial,none}`                                                             | —                                                                                                                                                       |
| [Flex Grow][flex-grow]                         | Supported | Core               | `grow`, `grow-0`                                                                         | —                                                                                                                                                       |
| [Flex Shrink][flex-shrink]                     | Supported | Core               | `shrink`, `shrink-0`                                                                     | —                                                                                                                                                       |
| [Order][order]                                 | Supported | Core               | `order-*`, `-order-*`                                                                    | —                                                                                                                                                       |
| [Grid Template Columns][grid-template-columns] | Partial   | Core + theme       | `grid-cols-{1..12}`                                                                      | `grid-cols-none` and `grid-cols-subgrid` are unavailable.                                                                                               |
| [Grid Column Start / End][grid-column]         | Supported | Core + Lynx plugin | `col-{start,end}-*`, `-col-{start,end}-*` (Core); `col-{auto,span-*}` (Lynx replacement) | The Lynx plugin replaces Tailwind's `gridColumn` core plugin and emits `grid-column-start` / `grid-column-end` rather than the `grid-column` shorthand. |
| [Grid Template Rows][grid-template-rows]       | Partial   | Core + theme       | `grid-rows-{1..12}`                                                                      | `grid-rows-none` and `grid-rows-subgrid` are unavailable.                                                                                               |
| [Grid Row Start / End][grid-row]               | Supported | Core + Lynx plugin | `row-{start,end}-*`, `-row-{start,end}-*` (Core); `row-{auto,span-*}` (Lynx replacement) | The Lynx plugin replaces Tailwind's `gridRow` core plugin and emits `grid-row-start` / `grid-row-end` rather than the `grid-row` shorthand.             |
| [Grid Auto Flow][grid-auto-flow]               | Supported | Core               | `grid-flow-{row,col,dense,row-dense,col-dense}`                                          | —                                                                                                                                                       |
| [Grid Auto Columns][grid-auto-columns]         | Partial   | Core + theme       | `auto-cols-{auto,max,fr}`                                                                | `auto-cols-min` is unavailable.                                                                                                                         |
| [Grid Auto Rows][grid-auto-rows]               | Partial   | Core + theme       | `auto-rows-{auto,max,fr}`                                                                | `auto-rows-min` is unavailable.                                                                                                                         |
| [Gap][gap]                                     | Supported | Core               | `gap-*`, `gap-{x,y}-*`                                                                   | —                                                                                                                                                       |
| [Justify Content][justify-content]             | Partial   | Lynx plugin        | `justify-{start,end,center,between,around,evenly,stretch}`                               | `justify-normal` is unavailable.                                                                                                                        |
| [Justify Items][justify-items]                 | Supported | Core               | `justify-items-{start,end,center,stretch}`                                               | —                                                                                                                                                       |
| [Justify Self][justify-self]                   | Supported | Core               | `justify-self-{auto,start,end,center,stretch}`                                           | —                                                                                                                                                       |
| [Align Content][align-content]                 | Partial   | Lynx plugin        | `content-{start,end,center,between,around,stretch}`                                      | `content-{normal,baseline,evenly}` is unavailable.                                                                                                      |
| [Align Items][align-items]                     | Supported | Core               | `items-{start,end,center,baseline,stretch}`                                              | —                                                                                                                                                       |
| [Align Self][align-self]                       | Supported | Core               | `self-{auto,start,end,center,stretch,baseline}`                                          | —                                                                                                                                                       |

### Unsupported

| Utility                        | Required CSS capability                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Place Content][place-content] | A Lynx replacement can expand to align/justify longhands, but `baseline` and `space-evenly` are unavailable. [Design note][utility-design-place]. |
| [Place Items][place-items]     | A Lynx replacement can expand to align/justify longhands, but `baseline` is unavailable. [Design note][utility-design-place].                     |
| [Place Self][place-self]       | A Lynx replacement can expand to supported align/justify longhands; integration is pending. [Design note][utility-design-place].                  |

## Spacing

### Supported

| Utility            | Status    | Implementation | Classes                                                           | Restrictions |
| ------------------ | --------- | -------------- | ----------------------------------------------------------------- | ------------ |
| [Padding][padding] | Supported | Core           | `{p,px,py,ps,pe,pt,pr,pb,pl}-*`                                   | —            |
| [Margin][margin]   | Supported | Core           | `{m,mx,my,ms,me,mt,mr,mb,ml}-*`, `-{m,mx,my,ms,me,mt,mr,mb,ml}-*` | —            |

### Unsupported

| Utility                | Required CSS capability                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| [Space Between][space] | Selector adaptation and SDK 3.6+ reverse composition. [Design note][utility-design-sibling-utilities]. |

## Sizing

| Utility                  | Status    | Implementation | Classes   | Restrictions |
| ------------------------ | --------- | -------------- | --------- | ------------ |
| [Width][width]           | Supported | Core           | `w-*`     | —            |
| [Min-Width][min-width]   | Supported | Core           | `min-w-*` | —            |
| [Max-Width][max-width]   | Supported | Core           | `max-w-*` | —            |
| [Height][height]         | Supported | Core           | `h-*`     | —            |
| [Min-Height][min-height] | Supported | Core           | `min-h-*` | —            |
| [Max-Height][max-height] | Supported | Core           | `max-h-*` | —            |
| [Size][size]             | Supported | Core           | `size-*`  | —            |

## Typography

### Supported and Partial

| Utility                            | Status    | Implementation | Classes                                     | Restrictions                                                                                                                                                                                             |
| ---------------------------------- | --------- | -------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Font Family][font-family]         | Supported | Core           | `font-<family>`                             | Theme feature/variation settings require Android/iOS SDK 3.4+ or Web; feature tags are limited on iOS, and both properties are unavailable on Harmony/Clay. [Design note][utility-design-font-features]. |
| [Font Size][font-size]             | Supported | Core           | `text-<font-size>`                          | —                                                                                                                                                                                                        |
| [Font Style][font-style]           | Supported | Core           | `italic`, `not-italic`                      | —                                                                                                                                                                                                        |
| [Font Weight][font-weight]         | Supported | Core           | `font-<weight>`                             | —                                                                                                                                                                                                        |
| [Letter Spacing][letter-spacing]   | Supported | Core           | `tracking-*`, `-tracking-*`                 | —                                                                                                                                                                                                        |
| [Line Height][line-height]         | Supported | Core           | `leading-*`                                 | —                                                                                                                                                                                                        |
| [Text Align][text-align]           | Partial   | Lynx plugin    | `text-{left,center,right,start,end}`        | `text-justify` is unavailable.                                                                                                                                                                           |
| [Text Color][text-color]           | Supported | Core           | `text-<color>`                              | Slash modifiers require SDK 3.4+ on native. [Design note][utility-design-color-opacity].                                                                                                                 |
| [Text Decoration][text-decoration] | Partial   | Lynx plugin    | `underline`, `line-through`, `no-underline` | Uses the shorthand. [Design note][utility-design-text-decoration].                                                                                                                                       |
| [Text Overflow][text-overflow]     | Supported | Core           | `truncate`, `text-{ellipsis,clip}`          | —                                                                                                                                                                                                        |
| [Text Indent][text-indent]         | Supported | Core           | `indent-*`, `-indent-*`                     | —                                                                                                                                                                                                        |
| [Vertical Align][vertical-align]   | Supported | Core           | `align-*`                                   | —                                                                                                                                                                                                        |
| [Whitespace][whitespace]           | Partial   | Lynx plugin    | `whitespace-{normal,nowrap}`                | Preformatted and `break-spaces` values are unavailable.                                                                                                                                                  |
| [Word Break][word-break]           | Partial   | Lynx plugin    | `break-{normal,all}`                        | `break-normal` does not reset `overflow-wrap`; `break-{keep,words}` is unavailable.                                                                                                                      |

### Unsupported

| Utility                                                | Required CSS capability                                                                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Font Smoothing][font-smoothing]                       | Platform font rasterization controls.                                                                                                                              |
| [Font Variant Numeric][font-variant-numeric]           | Native property unavailable. [Design note][utility-design-font-features].                                                                                          |
| [Line Clamp][line-clamp]                               | Multi-line overflow clamping and line-box counting.                                                                                                                |
| [List Style Image][list-style-image]                   | List markers with image sources (`list-style-image`).                                                                                                              |
| [List Style Position][list-style-position]             | List marker positioning (`list-style-position`).                                                                                                                   |
| [List Style Type][list-style-type]                     | List marker generation (`list-style-type`).                                                                                                                        |
| [Text Decoration Color][text-decoration-color]         | Longhand supported; composition pending. [Design note][utility-design-text-decoration].                                                                            |
| [Text Decoration Style][text-decoration-style]         | Longhand unavailable; shorthand only. [Design note][utility-design-text-decoration].                                                                               |
| [Text Decoration Thickness][text-decoration-thickness] | Longhand available on Android/iOS in SDK 4.0+; unavailable on Harmony, Clay, and Lynx for Web; composition pending. [Design note][utility-design-text-decoration]. |
| [Text Underline Offset][text-underline-offset]         | `text-underline-offset`.                                                                                                                                           |
| [Text Transform][text-transform]                       | Text case transformation (`text-transform`).                                                                                                                       |
| [Text Wrap][text-wrap]                                 | Modern text wrapping controls (`text-wrap`).                                                                                                                       |
| [Hyphens][hyphens]                                     | Defined by Lynx, but `manual` and `none` have the same Android/iOS behavior; cross-target validation is pending. [Design note][utility-design-hyphens].            |
| [Content][content]                                     | Generated content and pseudo-elements (`content`, `::before`, `::after`).                                                                                          |

## Backgrounds

### Supported and Partial

| Utility                                    | Status    | Implementation | Classes                                                                         | Restrictions                                                                                        |
| ------------------------------------------ | --------- | -------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [Background Clip][background-clip]         | Partial   | Lynx plugin    | `bg-clip-{border,padding,content}`                                              | `bg-clip-text` is unavailable.                                                                      |
| [Background Color][background-color]       | Supported | Core           | `bg-<color>`                                                                    | Slash modifiers require SDK 3.4+ on native. [Design note][utility-design-color-opacity].            |
| [Background Origin][background-origin]     | Supported | Core           | `bg-origin-{border,padding,content}`                                            | —                                                                                                   |
| [Background Position][background-position] | Supported | Core           | `bg-{bottom,center,left,left-bottom,left-top,right,right-bottom,right-top,top}` | —                                                                                                   |
| [Background Repeat][background-repeat]     | Supported | Core           | `bg-{repeat,no-repeat,repeat-x,repeat-y,repeat-round,repeat-space}`             | —                                                                                                   |
| [Background Size][background-size]         | Supported | Core           | `bg-{auto,cover,contain}`                                                       | —                                                                                                   |
| [Background Image][background-image]       | Partial   | Core           | `bg-none`, `bg-[<image>]`                                                       | Directional gradients require color-stop composition. [Design note][utility-design-gradient-stops]. |

### Unsupported

| Utility                                        | Required CSS capability                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| [Background Attachment][background-attachment] | Background attachment and scroll-relative painting.                                  |
| [Gradient Color Stops][gradient-color-stops]   | SDK 3.6+ variable composition pending. [Design note][utility-design-gradient-stops]. |

## Borders

### Supported

| Utility                        | Status    | Implementation | Classes                                                                                                                    | Restrictions                                                                             |
| ------------------------------ | --------- | -------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [Border Radius][border-radius] | Supported | Core           | `rounded`, `rounded-{s,e,t,r,b,l,ss,se,ee,es,tl,tr,br,bl}`, `rounded-*`, `rounded-{s,e,t,r,b,l,ss,se,ee,es,tl,tr,br,bl}-*` | —                                                                                        |
| [Border Width][border-width]   | Supported | Core           | `border`, `border-{x,y,s,e,t,r,b,l}`, `border-*`, `border-{x,y,s,e,t,r,b,l}-*`                                             | —                                                                                        |
| [Border Color][border-color]   | Supported | Core           | `border-<color>`, `border-{x,y,s,e,t,r,b,l}-<color>`                                                                       | Slash modifiers require SDK 3.4+ on native. [Design note][utility-design-color-opacity]. |
| [Border Style][border-style]   | Supported | Core           | `border-{solid,dashed,dotted,double,none}`                                                                                 | —                                                                                        |

### Unsupported

| Utility                                | Required CSS capability                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [Divide Width][divide-width]           | Sibling selector and reverse composition pending. [Design note][utility-design-sibling-utilities].  |
| [Divide Color][divide-color]           | Sibling selector and color composition pending. [Design note][utility-design-sibling-utilities].    |
| [Divide Style][divide-style]           | Sibling selector integration pending. [Design note][utility-design-sibling-utilities].              |
| [Outline Width][outline-width]         | The legacy Lynx API remains available, but is no longer recommended and is planned for deprecation. |
| [Outline Color][outline-color]         | The legacy Lynx API remains available, but is no longer recommended and is planned for deprecation. |
| [Outline Style][outline-style]         | The legacy Lynx API remains available, but is no longer recommended and is planned for deprecation. |
| [Outline Offset][outline-offset]       | No corresponding Lynx CSS property.                                                                 |
| [Ring Width][ring-width]               | SDK 3.6+ variables; composition pending. [Design note][utility-design-box-shadow].                  |
| [Ring Color][ring-color]               | SDK 3.6+ variables; composition pending. [Design note][utility-design-box-shadow].                  |
| [Ring Offset Width][ring-offset-width] | SDK 3.6+ variables; composition pending. [Design note][utility-design-box-shadow].                  |
| [Ring Offset Color][ring-offset-color] | SDK 3.6+ variables; composition pending. [Design note][utility-design-box-shadow].                  |

## Effects

### Supported

| Utility                  | Status    | Implementation         | Classes                                                              | Restrictions                                                  |
| ------------------------ | --------- | ---------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------- |
| [Box Shadow][box-shadow] | Supported | Lynx plugin(s) + theme | `shadow`, `shadow-{sm,md,lg,xl,2xl,inner,none}`, `shadow-[<shadow>]` | Direct output only. [Design note][utility-design-box-shadow]. |
| [Opacity][opacity]       | Supported | Core                   | `opacity-*`                                                          | —                                                             |

### Unsupported

| Utility                                        | Required CSS capability                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| [Box Shadow Color][box-shadow-color]           | SDK 3.6+ variables; composition pending. [Design note][utility-design-box-shadow]. |
| [Mix Blend Mode][mix-blend-mode]               | Element compositing blend modes (`mix-blend-mode`).                                |
| [Background Blend Mode][background-blend-mode] | Layered background compositing (`background-blend-mode`).                          |

## Filters

### Supported

| Utility                | Status    | Implementation         | Classes                                     | Restrictions                                                                                             |
| ---------------------- | --------- | ---------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [Blur][blur]           | Supported | Lynx plugin            | `blur`, `blur-{0,none,sm,md,lg,xl,2xl,3xl}` | Writes `filter` directly; filter utilities are mutually exclusive.                                       |
| [Grayscale][grayscale] | Supported | Lynx plugin(s) + theme | `grayscale`, `grayscale-{0,25,50,75,none}`  | Adds `25`, `50`, `75`, and `none`; writes `filter` directly, so filter utilities are mutually exclusive. |

### Unsupported

| Utility                                    | Required CSS capability                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| [Brightness][brightness]                   | Available in SDK 3.6+; direct Lynx utility pending. [Design note][utility-design-filters]. |
| [Contrast][contrast]                       | Available in SDK 3.6+; direct Lynx utility pending. [Design note][utility-design-filters]. |
| [Drop Shadow][drop-shadow]                 | `drop-shadow()` filter function.                                                           |
| [Hue Rotate][hue-rotate]                   | `hue-rotate()` filter function.                                                            |
| [Invert][invert]                           | `invert()` filter function.                                                                |
| [Saturate][saturate]                       | Available in SDK 3.6+; direct Lynx utility pending. [Design note][utility-design-filters]. |
| [Sepia][sepia]                             | `sepia()` filter function.                                                                 |
| [Backdrop Blur][backdrop-blur]             | Backdrop capture and filtering (`backdrop-filter`, `blur()`).                              |
| [Backdrop Brightness][backdrop-brightness] | Backdrop capture and filtering (`backdrop-filter`, `brightness()`).                        |
| [Backdrop Contrast][backdrop-contrast]     | Backdrop capture and filtering (`backdrop-filter`, `contrast()`).                          |
| [Backdrop Grayscale][backdrop-grayscale]   | Backdrop capture and filtering (`backdrop-filter`, `grayscale()`).                         |
| [Backdrop Hue Rotate][backdrop-hue-rotate] | Backdrop capture and filtering (`backdrop-filter`, `hue-rotate()`).                        |
| [Backdrop Invert][backdrop-invert]         | Backdrop capture and filtering (`backdrop-filter`, `invert()`).                            |
| [Backdrop Opacity][backdrop-opacity]       | Backdrop capture and filtering (`backdrop-filter`, `opacity()`).                           |
| [Backdrop Saturate][backdrop-saturate]     | Backdrop capture and filtering (`backdrop-filter`, `saturate()`).                          |
| [Backdrop Sepia][backdrop-sepia]           | Backdrop capture and filtering (`backdrop-filter`, `sepia()`).                             |

The Lynx filter plugin also provides `filter-none`, which resets the entire
`filter` property and does not have a Tailwind CSS v3 sidebar entry.

## Tables

### Unsupported

| Utility                            | Required CSS capability                                |
| ---------------------------------- | ------------------------------------------------------ |
| [Border Collapse][border-collapse] | Table border conflict resolution (`border-collapse`).  |
| [Border Spacing][border-spacing]   | Table cell spacing (`border-spacing`).                 |
| [Table Layout][table-layout]       | Table formatting context and layout algorithms.        |
| [Caption Side][caption-side]       | Table captions and caption placement (`caption-side`). |

## Transitions and Animation

| Utility                                                  | Status    | Implementation         | Classes                                                                                                   | Restrictions                                                                                      |
| -------------------------------------------------------- | --------- | ---------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [Transition Property][transition-property]               | Supported | Lynx plugin(s) + theme | `transition`, `transition-{none,all,colors,opacity,transform,color,filter,background-color,border-color}` | `fill`, `stroke`, `backdrop-filter`, `box-shadow`, and `text-decoration-color` cannot transition. |
| [Transition Duration][transition-duration]               | Supported | Lynx plugin(s) + theme | `duration-*`                                                                                              | —                                                                                                 |
| [Transition Timing Function][transition-timing-function] | Supported | Lynx plugin(s) + theme | `ease-*`                                                                                                  | —                                                                                                 |
| [Transition Delay][transition-delay]                     | Supported | Lynx plugin(s) + theme | `delay-*`                                                                                                 | —                                                                                                 |
| [Animation][animation]                                   | Supported | Core                   | `animate-*`                                                                                               | —                                                                                                 |

## Transforms

| Utility                              | Status    | Implementation | Classes                                                          | Restrictions                                                                              |
| ------------------------------------ | --------- | -------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [Scale][scale]                       | Supported | Lynx plugin    | `scale-*`, `scale-{x,y}-*`, `-scale-*`, `-scale-{x,y}-*`         | Uses Lynx's adapted composed transform output.                                            |
| [Rotate][rotate]                     | Supported | Lynx plugin    | `rotate-*`, `rotate-{x,y,z}-*`, `-rotate-*`, `-rotate-{x,y,z}-*` | Uses Lynx's adapted composed transform output.                                            |
| [Translate][translate]               | Supported | Lynx plugin    | `translate-{x,y,z}-*`, `-translate-{x,y,z}-*`                    | Uses Lynx's adapted composed transform output; `translate-z` does not accept percentages. |
| [Skew][skew]                         | Supported | Lynx plugin    | `skew-{x,y}-*`, `-skew-{x,y}-*`                                  | Uses Lynx's adapted composed transform output.                                            |
| [Transform Origin][transform-origin] | Supported | Core           | `origin-*`                                                       | —                                                                                         |

The Lynx Transform plugin separately provides the shared composition controls
`transform` and `transform-{cpu,gpu,none}`. These controls apply across Scale,
Rotate, Translate, and Skew. See
[Transform Composition][utility-design-transform] for their implementation
model and the combined Skew compatibility risk.

See [preset extensions](./preset-extensions.md) for `transform-[...]`,
`solo-*`, `perspective`, and other Lynx-specific or selected v4 syntax.

## Interactivity

### Supported

| Utility                    | Status  | Implementation | Classes         | Restrictions                                                                                                                                                                                                             |
| -------------------------- | ------- | -------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Caret Color][caret-color] | Partial | Core           | `caret-<color>` | `<input>` only; SDK 3.4+ on native. The preset does not filter out `caret-inherit` or `caret-current`, but Lynx does not support their `inherit` and `currentColor` values. [Design note][utility-design-color-opacity]. |

### Unsupported

| Utility                                | Required CSS capability                                                                                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Accent Color][accent-color]           | Native form-control accent rendering (`accent-color`).                                                                                                                 |
| [Appearance][appearance]               | Native control appearance selection (`appearance`).                                                                                                                    |
| [Cursor][cursor]                       | Available on Lynx for Web and partially on Clay macOS/Windows in SDK 3.7+; mobile native targets are unsupported. [Design note][utility-design-pointer-events-cursor]. |
| [Pointer Events][pointer-events]       | Available on native targets in SDK 3.5+ and on Clay, but unavailable on Lynx for Web; preset integration pending. [Design note][utility-design-pointer-events-cursor]. |
| [Resize][resize]                       | User-resizable element affordances (`resize`).                                                                                                                         |
| [Scroll Behavior][scroll-behavior]     | Programmatic smooth scrolling (`scroll-behavior`).                                                                                                                     |
| [Scroll Margin][scroll-margin]         | Scroll target offsets (`scroll-margin-*`).                                                                                                                             |
| [Scroll Padding][scroll-padding]       | Scrollport offsets (`scroll-padding-*`).                                                                                                                               |
| [Scroll Snap Align][scroll-snap-align] | Scroll snap alignment (`scroll-snap-align`).                                                                                                                           |
| [Scroll Snap Stop][scroll-snap-stop]   | Scroll snap stopping behavior (`scroll-snap-stop`).                                                                                                                    |
| [Scroll Snap Type][scroll-snap-type]   | Scroll snap containers (`scroll-snap-type`).                                                                                                                           |
| [Touch Action][touch-action]           | Gesture arbitration between content and the host (`touch-action`).                                                                                                     |
| [User Select][user-select]             | Text selection control (`user-select`).                                                                                                                                |
| [Will Change][will-change]             | Rendering and compositing hints (`will-change`).                                                                                                                       |

## SVG

### Unsupported

| Utility                      | Required CSS capability               |
| ---------------------------- | ------------------------------------- |
| [Fill][fill]                 | SVG fill painting (`fill`).           |
| [Stroke][stroke]             | SVG stroke painting (`stroke`).       |
| [Stroke Width][stroke-width] | SVG stroke geometry (`stroke-width`). |

## Accessibility

### Unsupported

| Utility                                    | Required CSS capability                                                |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| [Screen Readers][screen-readers]           | Visually hidden layout, clipping, and accessibility-tree preservation. |
| [Forced Color Adjust][forced-color-adjust] | System forced-color mode and `forced-color-adjust`.                    |

## Preset Extensions

The preset also provides Lynx-specific additions and selected v4 utility
syntax outside Tailwind CSS v3's sidebar taxonomy. See
[preset extensions](./preset-extensions.md).

<!-- Tailwind CSS v3 documentation links -->

[accent-color]: https://v3.tailwindcss.com/docs/accent-color
[align-content]: https://v3.tailwindcss.com/docs/align-content
[align-items]: https://v3.tailwindcss.com/docs/align-items
[align-self]: https://v3.tailwindcss.com/docs/align-self
[animation]: https://v3.tailwindcss.com/docs/animation
[appearance]: https://v3.tailwindcss.com/docs/appearance
[aspect-ratio]: https://v3.tailwindcss.com/docs/aspect-ratio
[backdrop-blur]: https://v3.tailwindcss.com/docs/backdrop-blur
[backdrop-brightness]: https://v3.tailwindcss.com/docs/backdrop-brightness
[backdrop-contrast]: https://v3.tailwindcss.com/docs/backdrop-contrast
[backdrop-grayscale]: https://v3.tailwindcss.com/docs/backdrop-grayscale
[backdrop-hue-rotate]: https://v3.tailwindcss.com/docs/backdrop-hue-rotate
[backdrop-invert]: https://v3.tailwindcss.com/docs/backdrop-invert
[backdrop-opacity]: https://v3.tailwindcss.com/docs/backdrop-opacity
[backdrop-saturate]: https://v3.tailwindcss.com/docs/backdrop-saturate
[backdrop-sepia]: https://v3.tailwindcss.com/docs/backdrop-sepia
[background-attachment]: https://v3.tailwindcss.com/docs/background-attachment
[background-blend-mode]: https://v3.tailwindcss.com/docs/background-blend-mode
[background-clip]: https://v3.tailwindcss.com/docs/background-clip
[background-color]: https://v3.tailwindcss.com/docs/background-color
[background-image]: https://v3.tailwindcss.com/docs/background-image
[background-origin]: https://v3.tailwindcss.com/docs/background-origin
[background-position]: https://v3.tailwindcss.com/docs/background-position
[background-repeat]: https://v3.tailwindcss.com/docs/background-repeat
[background-size]: https://v3.tailwindcss.com/docs/background-size
[blur]: https://v3.tailwindcss.com/docs/blur
[border-collapse]: https://v3.tailwindcss.com/docs/border-collapse
[border-color]: https://v3.tailwindcss.com/docs/border-color
[border-radius]: https://v3.tailwindcss.com/docs/border-radius
[border-spacing]: https://v3.tailwindcss.com/docs/border-spacing
[border-style]: https://v3.tailwindcss.com/docs/border-style
[border-width]: https://v3.tailwindcss.com/docs/border-width
[box-decoration-break]: https://v3.tailwindcss.com/docs/box-decoration-break
[box-shadow]: https://v3.tailwindcss.com/docs/box-shadow
[box-shadow-color]: https://v3.tailwindcss.com/docs/box-shadow-color
[box-sizing]: https://v3.tailwindcss.com/docs/box-sizing
[break-after]: https://v3.tailwindcss.com/docs/break-after
[break-before]: https://v3.tailwindcss.com/docs/break-before
[break-inside]: https://v3.tailwindcss.com/docs/break-inside
[brightness]: https://v3.tailwindcss.com/docs/brightness
[caption-side]: https://v3.tailwindcss.com/docs/caption-side
[caret-color]: https://v3.tailwindcss.com/docs/caret-color
[clear]: https://v3.tailwindcss.com/docs/clear
[columns]: https://v3.tailwindcss.com/docs/columns
[container]: https://v3.tailwindcss.com/docs/container
[content]: https://v3.tailwindcss.com/docs/content
[contrast]: https://v3.tailwindcss.com/docs/contrast
[cursor]: https://v3.tailwindcss.com/docs/cursor
[display]: https://v3.tailwindcss.com/docs/display
[divide-color]: https://v3.tailwindcss.com/docs/divide-color
[divide-style]: https://v3.tailwindcss.com/docs/divide-style
[divide-width]: https://v3.tailwindcss.com/docs/divide-width
[drop-shadow]: https://v3.tailwindcss.com/docs/drop-shadow
[fill]: https://v3.tailwindcss.com/docs/fill
[flex]: https://v3.tailwindcss.com/docs/flex
[flex-basis]: https://v3.tailwindcss.com/docs/flex-basis
[flex-direction]: https://v3.tailwindcss.com/docs/flex-direction
[flex-grow]: https://v3.tailwindcss.com/docs/flex-grow
[flex-shrink]: https://v3.tailwindcss.com/docs/flex-shrink
[flex-wrap]: https://v3.tailwindcss.com/docs/flex-wrap
[float]: https://v3.tailwindcss.com/docs/float
[font-family]: https://v3.tailwindcss.com/docs/font-family
[font-size]: https://v3.tailwindcss.com/docs/font-size
[font-smoothing]: https://v3.tailwindcss.com/docs/font-smoothing
[font-style]: https://v3.tailwindcss.com/docs/font-style
[font-variant-numeric]: https://v3.tailwindcss.com/docs/font-variant-numeric
[font-weight]: https://v3.tailwindcss.com/docs/font-weight
[forced-color-adjust]: https://v3.tailwindcss.com/docs/forced-color-adjust
[gap]: https://v3.tailwindcss.com/docs/gap
[gradient-color-stops]: https://v3.tailwindcss.com/docs/gradient-color-stops
[grayscale]: https://v3.tailwindcss.com/docs/grayscale
[grid-auto-columns]: https://v3.tailwindcss.com/docs/grid-auto-columns
[grid-auto-flow]: https://v3.tailwindcss.com/docs/grid-auto-flow
[grid-auto-rows]: https://v3.tailwindcss.com/docs/grid-auto-rows
[grid-column]: https://v3.tailwindcss.com/docs/grid-column
[grid-row]: https://v3.tailwindcss.com/docs/grid-row
[grid-template-columns]: https://v3.tailwindcss.com/docs/grid-template-columns
[grid-template-rows]: https://v3.tailwindcss.com/docs/grid-template-rows
[height]: https://v3.tailwindcss.com/docs/height
[hue-rotate]: https://v3.tailwindcss.com/docs/hue-rotate
[hyphens]: https://v3.tailwindcss.com/docs/hyphens
[installation]: https://v3.tailwindcss.com/docs/installation
[invert]: https://v3.tailwindcss.com/docs/invert
[isolation]: https://v3.tailwindcss.com/docs/isolation
[justify-content]: https://v3.tailwindcss.com/docs/justify-content
[justify-items]: https://v3.tailwindcss.com/docs/justify-items
[justify-self]: https://v3.tailwindcss.com/docs/justify-self
[letter-spacing]: https://v3.tailwindcss.com/docs/letter-spacing
[line-clamp]: https://v3.tailwindcss.com/docs/line-clamp
[line-height]: https://v3.tailwindcss.com/docs/line-height
[list-style-image]: https://v3.tailwindcss.com/docs/list-style-image
[list-style-position]: https://v3.tailwindcss.com/docs/list-style-position
[list-style-type]: https://v3.tailwindcss.com/docs/list-style-type
[margin]: https://v3.tailwindcss.com/docs/margin
[max-height]: https://v3.tailwindcss.com/docs/max-height
[max-width]: https://v3.tailwindcss.com/docs/max-width
[min-height]: https://v3.tailwindcss.com/docs/min-height
[min-width]: https://v3.tailwindcss.com/docs/min-width
[mix-blend-mode]: https://v3.tailwindcss.com/docs/mix-blend-mode
[object-fit]: https://v3.tailwindcss.com/docs/object-fit
[object-position]: https://v3.tailwindcss.com/docs/object-position
[opacity]: https://v3.tailwindcss.com/docs/opacity
[order]: https://v3.tailwindcss.com/docs/order
[outline-color]: https://v3.tailwindcss.com/docs/outline-color
[outline-offset]: https://v3.tailwindcss.com/docs/outline-offset
[outline-style]: https://v3.tailwindcss.com/docs/outline-style
[outline-width]: https://v3.tailwindcss.com/docs/outline-width
[overflow]: https://v3.tailwindcss.com/docs/overflow
[overscroll-behavior]: https://v3.tailwindcss.com/docs/overscroll-behavior
[padding]: https://v3.tailwindcss.com/docs/padding
[place-content]: https://v3.tailwindcss.com/docs/place-content
[place-items]: https://v3.tailwindcss.com/docs/place-items
[place-self]: https://v3.tailwindcss.com/docs/place-self
[pointer-events]: https://v3.tailwindcss.com/docs/pointer-events
[position]: https://v3.tailwindcss.com/docs/position
[resize]: https://v3.tailwindcss.com/docs/resize
[ring-color]: https://v3.tailwindcss.com/docs/ring-color
[ring-offset-color]: https://v3.tailwindcss.com/docs/ring-offset-color
[ring-offset-width]: https://v3.tailwindcss.com/docs/ring-offset-width
[ring-width]: https://v3.tailwindcss.com/docs/ring-width
[rotate]: https://v3.tailwindcss.com/docs/rotate
[saturate]: https://v3.tailwindcss.com/docs/saturate
[scale]: https://v3.tailwindcss.com/docs/scale
[screen-readers]: https://v3.tailwindcss.com/docs/screen-readers
[scroll-behavior]: https://v3.tailwindcss.com/docs/scroll-behavior
[scroll-margin]: https://v3.tailwindcss.com/docs/scroll-margin
[scroll-padding]: https://v3.tailwindcss.com/docs/scroll-padding
[scroll-snap-align]: https://v3.tailwindcss.com/docs/scroll-snap-align
[scroll-snap-stop]: https://v3.tailwindcss.com/docs/scroll-snap-stop
[scroll-snap-type]: https://v3.tailwindcss.com/docs/scroll-snap-type
[sepia]: https://v3.tailwindcss.com/docs/sepia
[size]: https://v3.tailwindcss.com/docs/size
[skew]: https://v3.tailwindcss.com/docs/skew
[space]: https://v3.tailwindcss.com/docs/space
[stroke]: https://v3.tailwindcss.com/docs/stroke
[stroke-width]: https://v3.tailwindcss.com/docs/stroke-width
[table-layout]: https://v3.tailwindcss.com/docs/table-layout
[text-align]: https://v3.tailwindcss.com/docs/text-align
[text-color]: https://v3.tailwindcss.com/docs/text-color
[text-decoration]: https://v3.tailwindcss.com/docs/text-decoration
[text-decoration-color]: https://v3.tailwindcss.com/docs/text-decoration-color
[text-decoration-style]: https://v3.tailwindcss.com/docs/text-decoration-style
[text-decoration-thickness]: https://v3.tailwindcss.com/docs/text-decoration-thickness
[text-indent]: https://v3.tailwindcss.com/docs/text-indent
[text-overflow]: https://v3.tailwindcss.com/docs/text-overflow
[text-transform]: https://v3.tailwindcss.com/docs/text-transform
[text-underline-offset]: https://v3.tailwindcss.com/docs/text-underline-offset
[text-wrap]: https://v3.tailwindcss.com/docs/text-wrap
[top-right-bottom-left]: https://v3.tailwindcss.com/docs/top-right-bottom-left
[touch-action]: https://v3.tailwindcss.com/docs/touch-action
[transform-origin]: https://v3.tailwindcss.com/docs/transform-origin
[transition-delay]: https://v3.tailwindcss.com/docs/transition-delay
[transition-duration]: https://v3.tailwindcss.com/docs/transition-duration
[transition-property]: https://v3.tailwindcss.com/docs/transition-property
[transition-timing-function]: https://v3.tailwindcss.com/docs/transition-timing-function
[translate]: https://v3.tailwindcss.com/docs/translate
[user-select]: https://v3.tailwindcss.com/docs/user-select
[vertical-align]: https://v3.tailwindcss.com/docs/vertical-align
[visibility]: https://v3.tailwindcss.com/docs/visibility
[whitespace]: https://v3.tailwindcss.com/docs/whitespace
[width]: https://v3.tailwindcss.com/docs/width
[will-change]: https://v3.tailwindcss.com/docs/will-change
[word-break]: https://v3.tailwindcss.com/docs/word-break
[z-index]: https://v3.tailwindcss.com/docs/z-index
[utility-design-box-shadow]: ./utility-design-notes.md#box-shadow-composition
[utility-design-color-opacity]: ./utility-design-notes.md#color-opacity
[utility-design-filters]: ./utility-design-notes.md#brightness-contrast-and-saturate-filters
[utility-design-font-features]: ./utility-design-notes.md#font-feature-settings
[utility-design-gradient-stops]: ./utility-design-notes.md#gradient-color-stops
[utility-design-hyphens]: ./utility-design-notes.md#hyphens
[utility-design-place]: ./utility-design-notes.md#place-content-items-and-self
[utility-design-pointer-events-cursor]: ./utility-design-notes.md#pointer-events-and-cursor
[utility-design-sibling-utilities]: ./utility-design-notes.md#sibling-based-spacing-and-borders
[utility-design-text-decoration]: ./utility-design-notes.md#text-decoration-composition
[utility-design-transform]: ./utility-design-notes.md#transform-composition
