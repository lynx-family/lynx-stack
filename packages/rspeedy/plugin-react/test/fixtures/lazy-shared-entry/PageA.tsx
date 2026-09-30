import { describe } from './shared.js'

export default function PageA() {
  const onTap = () => {
    'main thread'
    console.info(describe('PageA-main-thread'))
  }

  return <text main-thread:bindtap={onTap}>{describe('PageA')}</text>
}
