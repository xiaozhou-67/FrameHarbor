<script setup lang="ts">
defineProps<{ loading: boolean; error: string }>();
defineEmits<{ retry: [] }>();
</script>
<template>
  <div v-if="loading" class="loading-state" role="status">
    <span class="loader"></span><span>正在准备你的光影旅程…</span>
  </div>
  <div v-else-if="error" class="empty-state" role="alert">
    <span class="eyebrow">CONNECTION PAUSED</span>
    <h2>稍等一帧</h2>
    <p>{{ error }}</p>
    <button class="button secondary" @click="$emit('retry')">重新加载</button>
  </div>
  <slot v-else />
</template>
