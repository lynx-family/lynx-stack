// This file mirrors the implementation of `src/elements/htmlTemplates.ts`.
// Any changes to the templates here must be synchronized with `htmlTemplates.ts`.

pub const TEMPLATE_SCROLL_VIEW: &str = r#"<style>
  .placeholder-dom {
    display: none;
    flex: 0 0 0;
    align-self: stretch;
    min-height: 0;
    min-width: 0;
  }
  .mask {
    z-index: 1;
    position: sticky;
  }
  .observer-container {
    flex-direction: inherit;
    overflow: visible;
  }
  .observer {
    display: flex;
  }
  ::-webkit-scrollbar {
    display: none;
  }

  @keyframes topFading {
    0% {
      box-shadow: transparent 0px 0px 0px 0px;
    }
    5% {
      box-shadow: var(--scroll-view-bg-color) 0px 0px
        var(--scroll-view-fading-edge-length)
        var(--scroll-view-fading-edge-length);
    }
    100% {
      box-shadow: var(--scroll-view-bg-color) 0px 0px
        var(--scroll-view-fading-edge-length)
        var(--scroll-view-fading-edge-length);
    }
  }
  @keyframes botFading {
    0% {
      box-shadow: var(--scroll-view-bg-color) 0px 0px
        var(--scroll-view-fading-edge-length)
        var(--scroll-view-fading-edge-length);
    }
    95% {
      box-shadow: var(--scroll-view-bg-color) 0px 0px
        var(--scroll-view-fading-edge-length)
        var(--scroll-view-fading-edge-length);
    }
    100% {
      box-shadow: transparent 0px 0px 0px 0px;
    }
  }
</style>
  <div
    class="mask placeholder-dom"
    id="top-fade-mask"
    part="top-fade-mask"
  ></div>
  <div
    class="observer-container placeholder-dom"
    part="upper-threshold-observer"
  >
    <div
      class="observer placeholder-dom"
      id="upper-threshold-observer"
    ></div>
  </div>
  <slot></slot>
  <div
    class="observer-container placeholder-dom"
    part="lower-threshold-observer"
  >
    <div
      class="observer placeholder-dom"
      id="lower-threshold-observer"
    ></div>
  </div>
  <div
    class="mask placeholder-dom"
    id="bot-fade-mask"
    part="bot-fade-mask"
  ></div>"#;

pub const TEMPLATE_X_AUDIO_TT: &str = r#"<audio id="audio"></audio>"#;

pub fn template_x_image(src: Option<&str>) -> Result<String, String> {
  if let Some(src_str) = src {
    let has_xss = src_str
      .to_lowercase()
      .split('<')
      .skip(1)
      .any(|part| part.trim_start().starts_with("script"));

    if has_xss {
      return Err(
        "detected <script, this is a potential XSS attack, please check your src".to_string(),
      );
    }
    Ok(format!(
      r#"<img part="img" alt="" id="img" src="{src_str}"/> "#
    ))
  } else {
    Ok(r#"<img part="img" alt="" id="img" /> "#.to_string())
  }
}

pub fn template_filter_image(src: Option<&str>) -> Result<String, String> {
  template_x_image(src)
}

pub const TEMPLATE_X_INPUT: &str = r#"<style>
  #input:focus {
    outline: none;
  }
  #form {
    display: none;
  }
</style>
<form id="form" part="form" method="dialog">
  <input
    id="input"
    part="input"
    step="any"
    type="text"
    inputmode="text"
    spell-check="true"
  />
</form>"#;

pub const TEMPLATE_X_LIST: &str = r#"<style>
  .placeholder-dom {
    display: none;
    flex: 0 0 0;
    align-self: stretch;
    min-height: 0;
    min-width: 0;
  }
  .observer-container {
    flex-direction: inherit;
    overflow: visible;
  }
  .observer {
    display: flex;
  }
</style>
<div id="content" part="content">
  <div
    class="observer-container placeholder-dom"
    part="upper-threshold-observer"
  >
    <div
      class="observer placeholder-dom"
      id="upper-threshold-observer"
    ></div>
  </div>
  <slot part="slot"></slot>
  <div
    class="observer-container placeholder-dom"
    part="lower-threshold-observer"
  >
    <div
      class="observer placeholder-dom"
      id="lower-threshold-observer"
    ></div>
  </div>
</div>"#;

pub const TEMPLATE_X_OVERLAY_NG: &str = r#"<style>
  #dialog[open] {
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    position: fixed;
    overscroll-behavior: contain;
    scrollbar-width: none;
  }
  #dialog[open]::-webkit-scrollbar {
    display: none;
  }
  #dialog::backdrop {
    background-color: transparent;
  }
  .overlay-inner {
    position: sticky;
    top: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .overlay-inner > * {
    pointer-events: auto;
  }
  .overlay-placeholder {
    width: 100%;
    height: 1px;
  }
</style>
<dialog id="dialog" part="dialog">
  <div class="overlay-inner">
    <slot></slot>
  </div>
  <div class="overlay-placeholder"></div>
</dialog>"#;

pub const TEMPLATE_X_REFRESH_VIEW: &str = r#"<style>
  .bounce-container {
    overflow: scroll;
    overscroll-behavior: contain;
    scroll-snap-type: y mandatory;
    scroll-behavior: smooth;
    scrollbar-width: none;
  }
  .overflow-placeholder {
    min-height: 30%;
    min-width: 100%;
    flex-shrink: 0;
    scroll-snap-align: none;
  }
  .not-shrink {
    height: 100%;
    width: 100%;
    min-height: 100%;
    min-width: 100%;
    flex-shrink: 0;
  }
  .vertical {
    display: flex;
    flex-direction: column;
  }
  #content {
    scroll-snap-align: center;
  }
</style>
<div id="container" part="container" class="bounce-container not-shrink vertical">
  <div
    id="placeholder-top"
    class="overflow-placeholder bounce-item"
    part="placeholder-top"
  ></div>
  <slot name="header"></slot>
  <div id="content" part="content" class="not-shrink vertical">
    <slot part="slot"></slot>
  </div>
  <slot name="footer"></slot>
  <div
    id="placeholder-bot"
    class="overflow-placeholder bounce-item"
    part="placeholder-bot"
  ></div>
</div>"#;

pub const TEMPLATE_X_SWIPER: &str = r#"<style>
  #bounce-padding {
    display: none;
    flex: 0 0 0;
    align-self: stretch;
    scroll-snap-align: none;
    flex-basis: 100%;
  }
  #content {
    position: relative;
    display: flex;
    flex: 0 0 100%;
    flex-direction: inherit;
    flex-wrap: inherit;
    align-self: stretch;
    justify-content: inherit;
    align-items: inherit;
    overflow: inherit;
    scrollbar-width: none;
    scroll-snap-align: start;
    scroll-snap-type: inherit;
  }
  div::-webkit-scrollbar {
    display: none;
  }
  #indicator-container {
    display: none;
  }
  #indicator-container > div {
    animation-name: indicator-dot;
    animation-duration: 100ms;
  }
  @keyframes indicator-dot {
    30%,
    70% {
      background-color: var(--indicator-color);
    }
    31%,
    69% {
      background-color: var(--indicator-active-color);
    }
  }
</style>
<style id="indicator-style"></style>
<div id="bounce-padding" part="bounce-padding"></div>
<div id="indicator-container" part="indicator-container"></div>
<div id="content" part="content">
  <slot part="slot-start" name="circular-start" id="circular-start"></slot>
  <slot part="slot"></slot>
  <slot part="slot-end" name="circular-end" id="circular-end"></slot>
</div>"#;

pub const TEMPLATE_X_TEXT: &str = r#"<div id="inner-box" part="inner-box"><slot part="slot"></slot><slot name="inline-truncation"></slot></div>"#;

pub fn template_inline_image(src: Option<&str>) -> Result<String, String> {
  template_x_image(src)
}

pub const TEMPLATE_X_TEXTAREA: &str = r#"<style>
  #textarea:focus,
  #textarea:focus-visible {
    border: inherit;
    outline: inherit;
  }
</style>
<form id="form" part="form" method="dialog">
  <textarea id="textarea" part="textarea"></textarea>
</form>"#;

pub const TEMPLATE_X_VIEWPAGE_NG: &str = r#"<style>
  #bounce-padding {
    display: none;
    flex: 0 0 0;
    align-self: stretch;
    scroll-snap-align: none;
    flex-basis: 100%;
  }
  #content {
    flex: 0 0 100%;
    flex-direction: row;
    align-self: stretch;
    display: inherit;
    justify-content: inherit;
    align-items: inherit;
    overflow: inherit;
    scrollbar-width: none;
    scroll-snap-type: inherit;
  }
  #content::-webkit-scrollbar {
    display: none;
  }
</style>
<div id="bounce-padding" part="bounce-padding"></div>
<div id="content" part="content">
  <slot></slot>
</div>"#;

pub const TEMPLATE_X_WEB_VIEW: &str = r#"<style>
  iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
</style>
<iframe id="webview" part="webview"></iframe>"#;

pub fn template_x_svg() -> String {
  r#"<img part="img" alt="" loading="lazy" id="img" /> "#.to_string()
}
