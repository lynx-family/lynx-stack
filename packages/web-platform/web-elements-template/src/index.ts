// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const templateScrollView = `<style>
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
  ></div>`;
export const templateXAudioTT = `<audio id="audio"></audio>`;
const XSSDetector = /<\s*script/g;
export const templateXImage = (attributes: { src?: string }) => {
  const { src } = attributes;
  if (src && XSSDetector.test(src)) {
    throw new Error(
      'detected <script, this is a potential XSS attack, please check your src',
    );
  }
  return `<img part="img" alt="" id="img" ${src ? `src="${src}"` : ''}/> `;
};

export const templateFilterImage = templateXImage;

export const templateXInput = `<style>
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
</form>`;
export const templateXList = `<style>
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
</div>`;

export const templateXOverlayNg = `<style>
  #dialog[open] {
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    position: fixed;
  }
  #dialog::backdrop {
    background-color: transparent;
  }
</style>
<dialog id="dialog" part="dialog">
  <slot></slot>
</dialog>`;

export const templateXRefreshView = `<style>
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
</div>`;

export const templateXSwiper = `<style>
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
</div>`;

export const templateXText =
  `<div id="inner-box" part="inner-box"><slot part="slot"></slot><slot name="inline-truncation"></slot></div>`;

export const templateInlineImage = templateXImage;

export const templateXTextarea = `<style>
  #textarea:focus,
  #textarea:focus-visible {
    border: inherit;
    outline: inherit;
  }
</style>
<form id="form" part="form" method="dialog">
  <textarea id="textarea" part="textarea"></textarea>
</form>`;

export const templateXViewpageNg = `<style>
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
</div>`;
