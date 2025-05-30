
<script>
import './App.css'
import lynxLogo from './assets/lynx-logo.png'

export default {
  data() {
    return {
      title: "Hello VueLynx",
      message: "Welcome to Vue 3 in Lynx!",
      count: 0,
    };
  },
  methods: {
    increment() {
      this.count++;
    },
  },
};
</script>
<template>
  <view>
    <image :src="lynxLogo" className='Logo--lynx' />
    <text className='Title'>Vue</text>
    <text className='Subtitle'>on Lynx</text>
    <h1>{{ title }}</h1>
    <p>{{ message }}</p>
    <button @click="increment">Count: {{ count }}</button>
  </view>
</template>
<style>
h1 {
  color: #42b983;
}
</style>
