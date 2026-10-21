<script setup lang="ts">
withDefaults(defineProps<{ page: number; total: number; pageSize?: number }>(), { pageSize: 20 });
defineEmits<{ change: [page: number] }>();
</script>
<template>
  <div v-if="total > pageSize" class="pagination">
    <button :disabled="page <= 1" @click="$emit('change', page - 1)">上一页</button
    ><span>{{ page }} / {{ Math.ceil(total / pageSize) }} · 共 {{ total }} 项</span
    ><button :disabled="page * pageSize >= total" @click="$emit('change', page + 1)">下一页</button>
  </div>
</template>
