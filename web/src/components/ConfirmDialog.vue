<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { answerConfirmation, confirmation } from '../state.ts';
const dialog = ref<HTMLDialogElement | null>(null);
watch(confirmation, async (value) => {
  await nextTick();
  if (value && !dialog.value?.open) dialog.value?.showModal();
  else if (!value) dialog.value?.close();
});
</script>
<template>
  <dialog
    ref="dialog"
    class="confirm-dialog"
    aria-labelledby="confirm-title"
    @cancel.prevent="answerConfirmation(false)"
    @close="!dialog?.open && answerConfirmation(false)"
  >
    <template v-if="confirmation"
      ><span class="eyebrow">PLEASE CONFIRM</span>
      <h2 id="confirm-title">{{ confirmation.title }}</h2>
      <p class="muted">{{ confirmation.message }}</p>
      <div class="button-row">
        <button class="button secondary" autofocus @click="answerConfirmation(false)">再想想</button
        ><button class="button" @click="answerConfirmation(true)">{{ confirmation.label }}</button>
      </div></template
    >
  </dialog>
</template>
