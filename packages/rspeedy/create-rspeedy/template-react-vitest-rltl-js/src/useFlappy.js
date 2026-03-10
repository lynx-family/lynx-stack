import { useCallback, useEffect, useRef, useState } from '@lynx-js/react'

import { createFlappy } from './lib/flappy.js'

/**
 * React hook for flappy-bird physics.
 *
 * Returns `[y, jump]` — a state value and a stable callback.
 * The game loop runs automatically; cleanup happens on unmount.
 * Options are read once on mount and not reactive to later changes.
 *
 * @param {object} [options]
 * @returns {[number, () => void]}
 */
export function useFlappy(options) {
  const [y, setY] = useState(0)
  const engineRef = useRef(null)

  if (!engineRef.current) {
    engineRef.current = createFlappy((newY) => {
      setY(newY)
    }, options)
  }

  useEffect(() => {
    return () => {
      engineRef.current?.destroy()
    }
  }, [])

  const jump = useCallback(() => {
    'background only'
    engineRef.current?.jump()
  }, [])

  return [y, jump]
}
