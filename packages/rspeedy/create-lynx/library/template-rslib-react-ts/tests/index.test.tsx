import '@testing-library/jest-dom'
import { expect, test } from '@rstest/core'
import { fireEvent, render } from '@lynx-js/react/testing-library'

import { Counter } from '../src/Counter.js'

test('Counter', async () => {
  const { findByText } = render(<Counter initialCount={1} />)

  expect(await findByText('Count: 1')).toBeInTheDocument()

  fireEvent.tap(await findByText('+1'))

  expect(await findByText('Count: 2')).toBeInTheDocument()
})
