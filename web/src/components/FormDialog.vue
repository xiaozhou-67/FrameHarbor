<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import Icon from './Icon.vue';
const props = defineProps<{ open: boolean; title: string; busy?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement | null>(null);
watch(
  () => props.open,
  async (open) => {
    await nextTick();
    if (open && !dialog.value?.open) dialog.value?.showModal();
    else if (!open) dialog.value?.close();
  },
  { immediate: true },
);
function close() {
  if (!props.busy) emit('close');
}
</script>
<template>
  <dialog ref="dialog" class="form-dialog" aria-labelledby="editor-title" @cancel.prevent="close">
    <div class="dialog-heading">
      <h2 id="editor-title">{{ title }}</h2>
      <button class="icon-button" type="button" :disabled="busy" aria-label="关闭编辑器" @click="close">
        <Icon name="close" />
      </button>
    </div>
    <slot />
  </dialog>
</template>
