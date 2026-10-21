import { onScopeDispose, ref, shallowRef, watch, type WatchSource } from 'vue';
import { messageOf } from '../api.ts';

export function useResource<T>(loader: (signal: AbortSignal) => Promise<T>, sources: WatchSource[] = []) {
  const data = shallowRef<T | null>(null);
  const loading = ref(false);
  const error = ref('');
  let controller: AbortController | null = null;
  let sequence = 0;
  async function reload() {
    const current = ++sequence;
    controller?.abort();
    controller = new AbortController();
    loading.value = true;
    error.value = '';
    data.value = null;
    try {
      const value = await loader(controller.signal);
      if (current === sequence) data.value = value;
    } catch (e) {
      if (current === sequence && !controller.signal.aborted) error.value = messageOf(e);
    } finally {
      if (current === sequence) loading.value = false;
    }
  }
  watch(
    sources.length ? sources : [() => 0],
    () => {
      void reload();
    },
    { immediate: true },
  );
  onScopeDispose(() => {
    sequence++;
    controller?.abort();
  });
  return { data, loading, error, reload };
}
