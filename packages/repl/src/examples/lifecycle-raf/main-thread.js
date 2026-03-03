// Demonstrates: lynx.requestAnimationFrame, lynx.cancelAnimationFrame
//
// lynx.requestAnimationFrame schedules a callback before the next repaint.
// Frameworks use this to batch DOM updates into a single frame,
// avoiding layout thrashing from multiple synchronous mutations.

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(container, 'padding:40px; align-items:center;');

  const title = __CreateText(0);
  __AppendElement(container, title);
  __AppendElement(title, __CreateRawText('requestAnimationFrame'));
  __SetInlineStyles(title, 'font-size:18px; font-weight:700;');

  const bar = __CreateView(0);
  __AppendElement(container, bar);
  __SetInlineStyles(
    bar,
    'width:20px; height:20px; background-color:#3b82f6; border-radius:10px; margin-top:24px;',
  );

  const frameInfo = __CreateText(0);
  const frameText = __CreateRawText('frame: 0');
  __AppendElement(container, frameInfo);
  __AppendElement(frameInfo, frameText);
  __SetInlineStyles(
    frameInfo,
    'font-size:12px; font-family:monospace; color:#666; margin-top:16px;',
  );

  __FlushElementTree();

  // Animate using requestAnimationFrame
  let frame = 0;
  let width = 20;
  let growing = true;

  function animate() {
    frame++;
    if (growing) {
      width += 2;
      if (width >= 280) growing = false;
    } else {
      width -= 2;
      if (width <= 20) growing = true;
    }

    __SetInlineStyles(
      bar,
      'width:' + width
        + 'px; height:20px; background-color:#3b82f6; border-radius:10px; margin-top:24px;',
    );
    __SetAttribute(frameText, 'text', 'frame: ' + frame);
    __FlushElementTree();

    // Schedule next frame
    lynx.requestAnimationFrame(animate);
  }

  // Start the animation loop
  lynx.requestAnimationFrame(animate);

  // Example of cancellation (not used here, but shown for reference):
  // const id = lynx.requestAnimationFrame(callback);
  // lynx.cancelAnimationFrame(id);
};
