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

function updateStyle(cssId = 0) {
  const cssHotUpdateList = __webpack_require__.cssHotUpdateList;
  if (!cssHotUpdateList) {
    throw new Error('cssHotUpdateList is not found');
  }

  for (const [chunkName, cssHotUpdatePath] of cssHotUpdateList) {
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
              entry: lynx.__chunk_entries__[chunkName],
            },
          });
        }
      },
    );
  }
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
