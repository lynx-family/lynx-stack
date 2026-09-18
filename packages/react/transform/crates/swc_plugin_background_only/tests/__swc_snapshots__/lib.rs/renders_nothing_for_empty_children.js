function App() {
    return <view>
          {__MAIN_THREAD__ ? <Skeleton/> : null}
        </view>;
}
