import { Component } from 'preact';
import TodoModel from './model.js';
import TodoFooter from './footer.jsx';
import TodoItem from './item.jsx';
import '../app.css';

const FILTERS = {
  all: () => true,
  active: (todo) => !todo.completed,
  completed: (todo) => todo.completed,
};

export class App extends Component {
  constructor() {
    super();
    this.model = new TodoModel(() => this.setState({}));
    this.state = { nowShowing: 'all', newTodo: '', editing: null };
  }

  handleNewTodoInput = (e) => {
    this.setState({ newTodo: e.detail.value ?? e.target?.value ?? '' });
  };

  handleNewTodoConfirm = () => {
    let val = (this.state.newTodo || '').trim();
    if (val) {
      this.model.addTodo(val);
      this.setState({ newTodo: '' });
    }
  };

  toggleAll = () => {
    let activeTodoCount = this.model.todos.reduce(
      (a, todo) => a + (todo.completed ? 0 : 1),
      0,
    );
    this.model.toggleAll(activeTodoCount > 0);
  };

  toggle = (todo) => {
    this.model.toggle(todo);
  };

  destroy = (todo) => {
    this.model.destroy(todo);
  };

  edit = (todo) => {
    this.setState({ editing: todo.id });
  };

  save = (todoToSave, text) => {
    this.model.save(todoToSave, text);
    this.setState({ editing: null });
  };

  cancel = () => {
    this.setState({ editing: null });
  };

  clearCompleted = () => {
    this.model.clearCompleted();
  };

  setFilter = (filter) => {
    this.setState({ nowShowing: filter });
  };

  render({}, { nowShowing = 'all', newTodo, editing }) {
    let { todos } = this.model,
      shownTodos = todos.filter(FILTERS[nowShowing]),
      activeTodoCount = todos.reduce(
        (a, todo) => a + (todo.completed ? 0 : 1),
        0,
      ),
      completedCount = todos.length - activeTodoCount;

    return (
      <view className='app'>
        {/* Header */}
        <view className='header'>
          <text className='title'>todos</text>
          <input
            className='new-todo'
            placeholder='What needs to be done?'
            value={newTodo}
            onInput={this.handleNewTodoInput}
            onConfirm={this.handleNewTodoConfirm}
          />
        </view>

        {/* Main section */}
        {todos.length > 0 && (
          <view className='main'>
            <view className='toggle-all-wrap' onClick={this.toggleAll}>
              <text
                className={'toggle-all-icon'
                  + (activeTodoCount === 0 ? ' all-checked' : '')}
              >
                {activeTodoCount === 0 ? '\u2611' : '\u2610'}
              </text>
              <text className='toggle-all-label'>Mark all</text>
            </view>

            <scroll-view className='todo-list' scroll-orientation='vertical'>
              {shownTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onToggle={this.toggle}
                  onDestroy={this.destroy}
                  onEdit={this.edit}
                  editing={editing === todo.id}
                  onSave={this.save}
                  onCancel={this.cancel}
                />
              ))}
            </scroll-view>
          </view>
        )}

        {/* Footer */}
        {(activeTodoCount > 0 || completedCount > 0) && (
          <TodoFooter
            count={activeTodoCount}
            completedCount={completedCount}
            nowShowing={nowShowing}
            onClearCompleted={this.clearCompleted}
            onFilter={this.setFilter}
          />
        )}
      </view>
    );
  }
}
