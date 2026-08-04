// Stands in for the code a deferred subtree drags along. It must not reach
// the main-thread bundle: `Feed` is `'background only'`, so its body — and
// with it this import — is gone from the island's main-thread compile.
export function formatFeed(value) {
  return `${value}::root-main-thread-heavy-marker`
}
