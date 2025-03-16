import { Store, LifecycleManager } from '@lynx-js/web-core';

// Shared store for component communication
const sharedStore = new Store({
  messages: [],
});

// Component A
class SenderComponent extends HTMLElement {
  private lifecycleManager = LifecycleManager.getInstance();

  connectedCallback() {
    this.lifecycleManager.registerHook('sender', {
      phase: 'beforeMount',
      callback: () => {
        this.render();
      },
    });
  }

  private sendMessage() {
    const state = sharedStore.getState();
    sharedStore.setState({
      messages: [...state.messages, 'New Message'],
    });
  }

  render() {
    this.innerHTML = `
      <button onclick="this.sendMessage()">Send Message</button>
    `;
  }
}

// Component B
class ReceiverComponent extends HTMLElement {
  connectedCallback() {
    sharedStore.subscribe((state) => {
      this.render(state.messages);
    });
  }

  render(messages: string[]) {
    this.innerHTML = `
      <ul>
        ${messages.map(msg => `<li>${msg}</li>`).join('')}
      </ul>
    `;
  }
}

customElements.define('sender-component', SenderComponent);
customElements.define('receiver-component', ReceiverComponent);
