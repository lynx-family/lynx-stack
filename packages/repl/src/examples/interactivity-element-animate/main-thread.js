// Demonstrates: __ElementAnimate — Web Animations API bridge
//
// __ElementAnimate(element, [operation, name, keyframes?, options?])
//   operation: 0=START, 1=PLAY, 2=PAUSE, 3=CANCEL, 4=FINISH
//
// Tap the buttons to control the animation.

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(
    container,
    'padding:40px; align-items:center; gap:20px;',
  );

  const title = __CreateText(0);
  __AppendElement(container, title);
  __AppendElement(title, __CreateRawText('__ElementAnimate'));
  __SetInlineStyles(
    title,
    'font-size:18px; font-weight:700; margin-bottom:4px;',
  );

  const subtitle = __CreateText(0);
  __AppendElement(container, subtitle);
  __AppendElement(
    subtitle,
    __CreateRawText('Controls the Web Animations API from the main thread'),
  );
  __SetInlineStyles(
    subtitle,
    'font-size:13px; color:#888; margin-bottom:16px;',
  );

  // Animated box
  const box = __CreateView(0);
  __AppendElement(container, box);
  __SetInlineStyles(
    box,
    'width:120px; height:120px; background-color:#3b82f6; border-radius:16px; margin-bottom:16px;',
  );

  // Start a looping pulse animation
  const animName = 'demo-pulse';
  __ElementAnimate(box, [
    0, // START
    animName,
    [
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0.5, transform: 'scale(0.8)' },
      { opacity: 1, transform: 'scale(1)' },
    ],
    {
      duration: 1500,
      iterationCount: 'infinite',
      timingFunction: 'ease-in-out',
    },
  ]);

  // Status text
  const statusRaw = __CreateRawText('Playing');
  const statusLabel = __CreateText(0);
  __AppendElement(container, statusLabel);
  __AppendElement(statusLabel, statusRaw);
  __SetInlineStyles(
    statusLabel,
    'font-size:14px; color:#666; margin-bottom:16px;',
  );

  // Worklet handler router
  const handlers = {};
  globalThis.runWorklet = function(handlerId, args) {
    if (handlers[handlerId]) handlers[handlerId](...args);
  };

  // Button row
  const btnRow = __CreateView(0);
  __AppendElement(container, btnRow);
  __SetInlineStyles(btnRow, 'flex-direction:row; gap:10px;');

  function makeButton(label, handlerId) {
    const btn = __CreateView(0);
    __AppendElement(btnRow, btn);
    __SetInlineStyles(
      btn,
      'padding:8px 18px; background-color:#1e293b; border-radius:6px; align-items:center; justify-content:center;',
    );
    const txt = __CreateText(0);
    __AppendElement(btn, txt);
    __AppendElement(txt, __CreateRawText(label));
    __SetInlineStyles(txt, 'color:#fff; font-size:13px;');
    __AddEvent(btn, 'bindEvent', 'tap', {
      type: 'worklet',
      value: handlerId,
    });
  }

  handlers['onPause'] = function() {
    __ElementAnimate(box, [2, /* PAUSE */ animName]);
    __SetAttribute(statusRaw, 'text', 'Paused');
    __FlushElementTree();
  };

  handlers['onPlay'] = function() {
    __ElementAnimate(box, [1, /* PLAY */ animName]);
    __SetAttribute(statusRaw, 'text', 'Playing');
    __FlushElementTree();
  };

  handlers['onCancel'] = function() {
    __ElementAnimate(box, [3, /* CANCEL */ animName]);
    __SetAttribute(statusRaw, 'text', 'Cancelled');
    __FlushElementTree();
  };

  handlers['onRestart'] = function() {
    __ElementAnimate(box, [
      0, /* START */
      animName,
      [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0.5, transform: 'scale(0.8)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      {
        duration: 1500,
        iterationCount: 'infinite',
        timingFunction: 'ease-in-out',
      },
    ]);
    __SetAttribute(statusRaw, 'text', 'Playing');
    __FlushElementTree();
  };

  makeButton('Pause', 'onPause');
  makeButton('Play', 'onPlay');
  makeButton('Cancel', 'onCancel');
  makeButton('Restart', 'onRestart');

  __FlushElementTree();
};
