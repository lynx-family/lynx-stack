/**
 * @param {Function} fn
 * @param {number} time
 * @returns {function(): void}
 */
function debounce(fn, time) {
  let timeout = 0;

  return function debounced(...args) {
    clearTimeout(timeout);

    timeout = setTimeout(
      () => fn.apply(this, args),
      time,
    );
  };
}

// The entry (`'__Card__'` or a lazy bundle url) of the template this runtime
// belongs to. On native Lynx, the runtime wrapper of each chunk records its
// entry in `lynx.__chunk_entries__`. A web bundle has no runtime wrapper, but
// lynx-core sets the global `globDynamicComponentEntry` while it runs a
// template's code, so it is read here, when this module is first evaluated.
const ownEntry = typeof globDynamicComponentEntry === 'undefined'
  ? undefined
  : globDynamicComponentEntry;

function updateStyle(cssId = 0) {
  const cssHotUpdateList = __webpack_require__.cssHotUpdateList;
  if (!cssHotUpdateList) {
    throw new Error('cssHotUpdateList is not found');
  }

  const chunkEntries = lynx.__chunk_entries__;
  cssHotUpdateList.forEach(([chunkName, cssHotUpdatePath], index) => {
    let entry;
    if (chunkEntries) {
      entry = chunkEntries[chunkName];
    } else if (index === cssHotUpdateList.length - 1) {
      // The template's own chunk is listed last.
      entry = ownEntry;
    } else {
      // Without `lynx.__chunk_entries__` (on web), the entry of an async
      // chunk is unknown, so its CSS is not updated.
      return;
    }
    lynx.requireModuleAsync(
      // lynx.requireModuleAsync has two level hash and we cannot delete
      // the LynxGroup level cache here.
      // Temporarily using `Date.now` to avoid being cached.
      __webpack_require__.p + cssHotUpdatePath,
      (err, ret) => {
        if (err) {
          throw new Error(
            `Failed to load CSS update file: ${cssHotUpdatePath}`,
          );
        }

        if (ret.content) {
          lynx.getCoreContext().dispatchEvent({
            type: 'lynx.hmr.css',
            data: {
              cssId,
              content: ret.content,
              deps: ret.deps,
              entry,
            },
          });
        }
      },
    );
  });
}

/**
 * @param {string | number} moduleId
 * @param {unknown} options
 * @param {number=} cssId
 * @returns {() => void}
 */
module.exports = function update(moduleId, options, cssId) {
  // TODO: should not pass cssId === ''
  if (!cssId) {
    cssId = 0;
  }

  function update() {
    updateStyle(cssId);
  }

  return debounce(update, 50);
};
