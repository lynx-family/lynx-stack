function App() {
    return <view>
          {__MAIN_THREAD__ ? null : <>
            <Feed/>
          </>}
        </view>;
}
