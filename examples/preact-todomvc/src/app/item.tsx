import { Component } from 'preact';

export default class TodoItem extends Component {
  handleSubmit = () => {
    let { onSave, onDestroy, todo } = this.props,
      val = this.state.editText.trim();
    if (val) {
      onSave(todo, val);
      this.setState({ editText: val });
    } else {
      onDestroy(todo);
    }
  };

  handleEdit = () => {
    let { onEdit, todo } = this.props;
    onEdit(todo);
    this.setState({ editText: todo.title });
  };

  toggle = () => {
    let { onToggle, todo } = this.props;
    onToggle(todo);
  };

  handleDestroy = () => {
    this.props.onDestroy(this.props.todo);
  };

  render(
    { todo: { title, completed }, editing },
    { editText },
  ) {
    return (
      <view
        className={'todo-item'
          + (completed ? ' completed' : '')
          + (editing ? ' editing' : '')}
      >
        <view className='todo-view'>
          {/* Checkbox toggle */}
          <view className='toggle-wrap' onClick={this.toggle}>
            <text className={'toggle-icon' + (completed ? ' checked' : '')}>
              {completed ? '\u2611' : '\u2610'}
            </text>
          </view>

          {/* Todo title — tap to edit */}
          <view className='todo-label-wrap' onClick={this.handleEdit}>
            <text
              className={'todo-label' + (completed ? ' completed-text' : '')}
            >
              {title}
            </text>
          </view>

          {/* Delete button */}
          <view className='destroy-btn' onClick={this.handleDestroy}>
            <text className='destroy-text'>{'\u00D7'}</text>
          </view>
        </view>

        {editing && (
          <input
            className='edit-input'
            value={editText}
            onInput={(e) =>
              this.setState({
                editText: e.detail.value ?? e.target?.value ?? '',
              })}
            onConfirm={() => this.handleSubmit()}
          />
        )}
      </view>
    );
  }
}
