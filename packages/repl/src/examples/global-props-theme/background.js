// Demonstrates: reacting to globalProps.theme changes
//
// The REPL host calls sendGlobalEvent("themeChanged") whenever the
// user toggles dark/light mode. The background thread receives it
// via GlobalEventEmitter and forwards it to the main thread so the
// UI can re-render with the new theme.

const emitter = lynx.getJSModule('GlobalEventEmitter');

emitter.addListener('themeChanged', function(theme) {
  lynx.getCoreContext().dispatchEvent({
    type: 'themeChanged',
    data: { theme },
  });
});
