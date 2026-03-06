// Demonstrates: Direct element access on the main thread
//
// The main thread has full access to elements:
//   - Variable references from element creation (__CreateView, etc.)
//   - __QuerySelector(root, selector) for CSS selector queries
//   - __SetID + __QuerySelector("#id") for ID-based lookup
//   - __InvokeUIMethod("boundingClientRect") for layout measurement
//   - event.target.elementRefptr for direct DOM access in worklet handlers
//
// In @lynx-js/react, this corresponds to:
//   useMainThreadRef(null) + main-thread:ref={ref}
//   ref.current?.setStyleProperty(...)

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(container, 'padding:40px; align-items:center;');

  const title = __CreateText(0);
  __AppendElement(container, title);
  __AppendElement(title, __CreateRawText('Element Refs: Main Thread'));
  __SetInlineStyles(
    title,
    'font-size:18px; font-weight:700; margin-bottom:8px;',
  );

  const subtitle = __CreateText(0);
  __AppendElement(container, subtitle);
  __AppendElement(
    subtitle,
    __CreateRawText(
      'Direct element access via refs, querySelector, and measurement',
    ),
  );
  __SetInlineStyles(
    subtitle,
    'font-size:13px; color:#888; margin-bottom:24px;',
  );

  // A target box — we'll reference it directly and measure it
  const targetBox = __CreateView(0);
  __AppendElement(container, targetBox);
  __SetID(targetBox, 'target-box');
  __SetInlineStyles(
    targetBox,
    'width:200px; height:100px; background-color:#3b82f6; border-radius:12px; '
      + 'align-items:center; justify-content:center; margin-bottom:16px;',
  );

  const boxLabel = __CreateText(0);
  __AppendElement(targetBox, boxLabel);
  __AppendElement(boxLabel, __CreateRawText('Tap me'));
  __SetInlineStyles(boxLabel, 'color:#fff; font-size:14px; font-weight:600;');

  // Measurement display
  const info = __CreateText(0);
  const infoRaw = __CreateRawText('Tap the box to measure it...');
  __AppendElement(container, info);
  __AppendElement(info, infoRaw);
  __SetInlineStyles(
    info,
    'font-size:12px; font-family:monospace; color:#555; margin-bottom:20px; white-space:pre;',
  );

  // Resize button
  const resizeBtn = __CreateView(0);
  __AppendElement(container, resizeBtn);
  __SetInlineStyles(
    resizeBtn,
    'padding:10px 20px; background-color:#8b5cf6; border-radius:8px;',
  );
  const resizeBtnLabel = __CreateText(0);
  __AppendElement(resizeBtn, resizeBtnLabel);
  __AppendElement(resizeBtnLabel, __CreateRawText('Random Resize & Measure'));
  __SetInlineStyles(
    resizeBtnLabel,
    'color:#fff; font-size:13px; font-weight:600;',
  );

  // Set up worklet handler router
  const handlers = {};
  globalThis.runWorklet = function(handlerId, args) {
    if (handlers[handlerId]) handlers[handlerId](...args);
  };

  // Helper: measure an element and display results
  function measureAndShow(label) {
    // Method 1: Direct variable reference — we already have targetBox
    // Method 2: __QuerySelector — find element by ID at runtime
    const found = __QuerySelector(page, '#target-box');
    if (!found) return;

    __InvokeUIMethod(found, 'boundingClientRect', {}, (result) => {
      if (result.code === 0) {
        const r = result.data;
        __SetAttribute(
          infoRaw,
          'text',
          label + '\n'
            + '  width:  ' + r.width.toFixed(0) + 'px\n'
            + '  height: ' + r.height.toFixed(0) + 'px\n'
            + '  top:    ' + r.top.toFixed(0) + 'px\n'
            + '  left:   ' + r.left.toFixed(0) + 'px',
        );
        __FlushElementTree();
      }
    });
  }

  let tapCount = 0;

  // Handler: measure the target box on tap
  handlers['onMeasure'] = function(_event) {
    tapCount++;
    measureAndShow('Tap #' + tapCount + ' — boundingClientRect:');
  };

  // Handler: randomly resize, then measure
  handlers['onResize'] = function(_event) {
    const w = 100 + Math.floor(Math.random() * 200);
    const h = 60 + Math.floor(Math.random() * 140);

    // Direct manipulation via stored variable reference — no lookup needed
    __SetInlineStyles(
      targetBox,
      'width:' + w + 'px; height:' + h + 'px; background-color:#3b82f6; '
        + 'border-radius:12px; align-items:center; justify-content:center; margin-bottom:16px;',
    );
    __FlushElementTree();

    // Measure after layout settles
    setTimeout(() => measureAndShow('After resize (' + w + 'x' + h + '):'), 50);
  };

  // Worklet handlers → run directly on the main thread
  __AddEvent(targetBox, 'bindEvent', 'tap', {
    type: 'worklet',
    value: 'onMeasure',
  });
  __AddEvent(resizeBtn, 'bindEvent', 'tap', {
    type: 'worklet',
    value: 'onResize',
  });

  __FlushElementTree();
};
