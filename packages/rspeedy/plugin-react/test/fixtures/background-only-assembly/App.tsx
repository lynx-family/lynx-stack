import { Feed } from './Feed.jsx'

export function App(): JSX.Element {
  return (
    <view>
      <text>app-renders-on-the-main-thread</text>
      <Feed />
    </view>
  )
}
