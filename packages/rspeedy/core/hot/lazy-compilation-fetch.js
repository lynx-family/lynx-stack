/* global __resourceQuery */

'use strict'

var urlBase = decodeURIComponent(__resourceQuery.slice(1))

/**
 * @param {{ data: string, onError: (err: Error) => void, active: boolean, module: module }} options options
 * @returns {() => void} function to destroy response
 */
export function keepAlive(options) {
  var data = options.data
  var onError = options.onError
  var active = options.active
  var module = options.module
  var ac = new AbortController()
  fetch(urlBase + data, {
    signal: ac.signal,
    mode: 'cors',
    redirect: 'follow',
    cache: 'no-store',
    headers: {
      'Accept': 'text/event-stream',
    },
  })
    .then(() => {
      if (!active && !module.hot) {
        console.log(
          'Hot Module Replacement is not enabled. Waiting for process restart...',
        )
      }
    })
    .catch(errorHandler)
  /**
   * @param {Error} err error
   */
  function errorHandler(err) {
    err.message = 'Problem communicating active modules to the server: '
      + err.message
    onError(err)
  }
  return function() {
    ac.abort()
  }
}
