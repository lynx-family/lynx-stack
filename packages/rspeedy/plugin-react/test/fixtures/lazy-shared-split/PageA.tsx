import { describe, describeOnMainThread } from './shared.js'

function onTap() {
  'main thread'
  console.info(describeOnMainThread('PageA-main-thread'))
}

export default function PageA() {
  return <text main-thread:bindtap={onTap}>{describe('PageA')}</text>
}
