export function App() {
  return (
    <view style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {(Array.from({ length: 3 }).fill(1)).map((index) => (
        <view
          style={{ margin: '1px', height: '100%', display: 'flex', flexDirection: 'row', backgroundColor: '#fa43e6' }}
        >
          {(Array.from({ length: 16 }).fill(1)).map((index) => (
            <view
              style={{
                margin: '1px',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#cccccc',
              }}
            >
              {(Array.from({ length: 16 }).fill(1)).map((index) => (
                <view
                  style={{
                    margin: '1px',
                    height: '100%',
                    display: 'flex',
                    flexWrap: 'wrap',
                    backgroundColor: '#333333',
                  }}
                >
                  {(Array.from({ length: 8 }).fill(1)).map((index) => (
                    <view style={{ width: '15%', height: '15%', margin: '1px', backgroundColor: 'red' }}></view>
                  ))}
                </view>
              ))}
            </view>
          ))}
        </view>
      ))}
    </view>
  );
}
