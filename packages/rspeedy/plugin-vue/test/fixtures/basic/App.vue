<template>
  <div class="app">
    <h1>{{ title }}</h1>
    <p>{{ message }}</p>
    <button @click="incrementCount">Count: {{ count }}</button>
  </div>
</template>

<script>
export default {
  name: "App",
  data() {
    return {
      title: "Vue Lynx App",
      message: "Welcome to Vue on Lynx!",
      count: 0,
    };
  },
  methods: {
    incrementCount() {
      this.count++;
    },
  },
};
</script>

<style>
.app {
  font-family: Arial, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  color: #42b983;
}

button {
  background-color: #42b983;
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #3aa876;
}
</style>
