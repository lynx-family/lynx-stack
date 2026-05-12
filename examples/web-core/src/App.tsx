import './App.css';
import Preview from './demo/index.js';

const App = () => {
  return (
    <div className='content'>
      <div className='title-container'>
        <h1>Luna Stage</h1>
        <p>Testing...</p>
      </div>
      <div className='preview-container'>
        <Preview />
      </div>
    </div>
  );
};

export default App;
