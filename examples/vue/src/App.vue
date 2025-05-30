<script setup>
// Import only what's needed from Vue
import { ref } from "@lynx-js/vue";
import { View, Text, Button } from "@lynx-js/vue/runtime-components";

const title = "Hello VueLynx";
const message = "Welcome to Vue 3 in Lynx!";
const count = ref(0);

function increment() {
  count.value++;
}
</script>

<template>
  <div>test</div>
  <View>
    <Text style="font-size: 24px; font-weight: bold; margin-bottom: 8px">
      Vue
    </Text>
    <Text style="font-size: 18px; color: #666; margin-bottom: 16px">
      on Lynx
    </Text>
    <Text style="color: #42b983; font-size: 20px">{{ title }}</Text>
    <Text>{{ message }}</Text>
    <Button
      @click="increment"
      style="
        background-color: #42b983;
        border: none;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        margin-top: 8px;
      "
    >
      Count: {{ count }}
    </Button>
  </View>
</template>
