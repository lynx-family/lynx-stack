import { Component } from 'preact';
import { pluralize } from './util.js';

export default class TodoFooter extends Component {
  render({ nowShowing, count, completedCount, onClearCompleted, onFilter }) {
    return (
      <view className='footer'>
        <text className='todo-count'>
          {count} {pluralize(count, 'item')} left
        </text>
        <view className='filters'>
          <view
            className={'filter-btn' + (nowShowing === 'all' ? ' selected' : '')}
            onClick={() => onFilter('all')}
          >
            <text
              className={'filter-text'
                + (nowShowing === 'all' ? ' selected' : '')}
            >
              All
            </text>
          </view>
          <view
            className={'filter-btn'
              + (nowShowing === 'active' ? ' selected' : '')}
            onClick={() => onFilter('active')}
          >
            <text
              className={'filter-text'
                + (nowShowing === 'active' ? ' selected' : '')}
            >
              Active
            </text>
          </view>
          <view
            className={'filter-btn'
              + (nowShowing === 'completed' ? ' selected' : '')}
            onClick={() => onFilter('completed')}
          >
            <text
              className={'filter-text'
                + (nowShowing === 'completed' ? ' selected' : '')}
            >
              Completed
            </text>
          </view>
        </view>
        {completedCount > 0 && (
          <view className='clear-btn' onClick={onClearCompleted}>
            <text className='clear-text'>Clear completed</text>
          </view>
        )}
      </view>
    );
  }
}
