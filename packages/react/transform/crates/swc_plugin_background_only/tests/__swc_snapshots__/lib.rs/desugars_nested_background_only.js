function App() {
    return <view>
          {__MAIN_THREAD__ ? __MAIN_THREAD__ ? <A/> : <><B/></> : <>
            <Feed/>
          </>}
        </view>;
}
