import { reactive, shallowRef } from 'vue';
import type { AuthState, User } from '../../shared/domain.ts';
import { api, messageOf, setCsrfToken } from './api.ts';

export const auth = reactive<AuthState & { ready: boolean; error: string }>({
  user: null,
  csrfToken: null,
  ready: false,
  error: '',
});
let initializing: Promise<void> | null = null;
export function acceptAuth(value: AuthState) {
  auth.user = value.user;
  auth.csrfToken = value.csrfToken;
  auth.error = '';
  setCsrfToken(value.csrfToken);
  auth.ready = true;
}
export async function ensureSession(force = false) {
  if (auth.ready && !force) return;
  if (!initializing)
    initializing = api<AuthState>('/auth/me')
      .then(acceptAuth)
      .catch((error) => {
        auth.error = messageOf(error);
        auth.ready = true;
      })
      .finally(() => {
        initializing = null;
      });
  await initializing;
}
window.addEventListener('frameharbor:unauthorized', () => acceptAuth({ user: null, csrfToken: null }));
export async function logout() {
  await api('/auth/logout', { method: 'POST' });
  acceptAuth({ user: null, csrfToken: null });
}
export function updateUser(user: User) {
  auth.user = user;
}
export const toasts = reactive<{ id: number; message: string; kind: 'success' | 'error' }[]>([]);
let toastId = 0;
export function notify(message: string, kind: 'success' | 'error' = 'success') {
  const id = ++toastId;
  toasts.push({ id, message, kind });
  if (toasts.length > 4) toasts.shift();
  window.setTimeout(() => {
    const index = toasts.findIndex((t) => t.id === id);
    if (index !== -1) toasts.splice(index, 1);
  }, 5500);
}
interface Confirmation {
  title: string;
  message: string;
  label: string;
  resolve: (answer: boolean) => void;
}
export const confirmation = shallowRef<Confirmation | null>(null);
export function confirmAction(title: string, message: string, label = '确认'): Promise<boolean> {
  confirmation.value?.resolve(false);
  return new Promise((resolve) => {
    confirmation.value = { title, message, label, resolve };
  });
}
export function answerConfirmation(value: boolean) {
  const current = confirmation.value;
  confirmation.value = null;
  current?.resolve(value);
}
