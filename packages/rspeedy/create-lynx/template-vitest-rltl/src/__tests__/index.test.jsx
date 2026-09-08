// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import '@testing-library/jest-dom'
import { expect, test } from 'vitest'
import { getQueriesForElement, render } from '@lynx-js/react/testing-library'

import { App } from '../App'

test('App', async () => {
  render(<App />)

  const { findByText } = getQueriesForElement(elementTree.root)
  const element = await findByText('Tap the logo and have fun!')

  expect(element).toBeInTheDocument()
})
