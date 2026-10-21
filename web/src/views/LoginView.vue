<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { AuthState } from '../../../shared/domain.ts';
import { api, messageOf } from '../api.ts';
import { acceptAuth, notify } from '../state.ts';
import Icon from '../components/Icon.vue';
const route = useRoute();
const router = useRouter();
const registering = ref(false);
const pending = ref(false);
const error = ref('');
const email = ref('');
const password = ref('');
const displayName = ref('');
const showPassword = ref(false);
async function submit() {
  pending.value = true;
  error.value = '';
  try {
    const result = await api<AuthState>(registering.value ? '/auth/register' : '/auth/login', {
      method: 'POST',
      body: {
        email: email.value.trim(),
        password: password.value,
        ...(registering.value ? { displayName: displayName.value } : {}),
      },
    });
    acceptAuth(result);
    notify(registering.value ? '欢迎来到帧港，故事从这里开始' : '欢迎回来，下一场见');
    const target = route.query.next;
    const safe =
      typeof target === 'string' &&
      target.startsWith('/') &&
      !target.startsWith('//') &&
      !target.startsWith('/login');
    await router.replace(safe ? target : result.user?.role === 'admin' ? '/admin' : '/account');
  } catch (e) {
    error.value = messageOf(e);
  } finally {
    pending.value = false;
  }
}
</script>
<template>
  <div class="container login-layout">
    <section class="login-story">
      <span class="eyebrow">WELCOME TO FRAMEHARBOR</span>
      <h1>下一段故事，<br />从你开始。</h1>
      <p>收藏那些让你心动的片名，<br />也收藏一段只属于自己的银幕时光。</p>
      <div class="login-poster-stack" aria-hidden="true">
        <img src="/art/tide.svg" alt="" /><img src="/art/aurora.svg" alt="" /><img
          src="/art/forest.svg"
          alt=""
        />
      </div>
      <span class="small muted">帧港 / 为每一次相遇留一帧</span>
    </section>
    <form class="login-form form-card" @submit.prevent="submit">
      <span class="eyebrow">{{ registering ? 'YOUR FIRST FRAME' : 'GOOD TO SEE YOU AGAIN' }}</span>
      <h2>{{ registering ? '加入帧港' : '欢迎回来' }}</h2>
      <p class="muted">{{ registering ? '用一个账号，开启你的观影旅程。' : '登录后，继续你的光影日常。' }}</p>
      <label v-if="registering"
        >怎么称呼你<input
          v-model="displayName"
          required
          minlength="2"
          maxlength="30"
          autocomplete="nickname"
          placeholder="2–30 个字符" /></label
      ><label
        >邮箱<input
          v-model="email"
          type="email"
          required
          maxlength="254"
          autocomplete="email"
          placeholder="you@example.com" /></label
      ><label
        >密码<span class="password-input"
          ><input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            required
            :minlength="registering ? 12 : 1"
            maxlength="128"
            :autocomplete="registering ? 'new-password' : 'current-password'"
            :placeholder="registering ? '至少 12 位，建议混合字母、数字和符号' : '输入你的密码'"
          /><button
            class="text-button"
            type="button"
            :aria-label="showPassword ? '隐藏密码' : '显示密码'"
            @click="showPassword = !showPassword"
          >
            {{ showPassword ? '隐藏' : '显示' }}
          </button></span
        ></label
      >
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button class="button full-width" :disabled="pending">
        {{ pending ? '正在连接…' : registering ? '创建我的账号' : '登录帧港'
        }}<Icon name="arrow" :size="18" />
      </button>
      <p class="login-switch">
        {{ registering ? '已经有账号？' : '第一次来帧港？'
        }}<button
          type="button"
          class="text-button"
          :disabled="pending"
          @click="
            registering = !registering;
            error = '';
          "
        >
          {{ registering ? '直接登录' : '创建账号' }}
        </button>
      </p>
      <p class="small muted">此项目提供演示购票体验，支付流程使用模拟确认。</p>
    </form>
  </div>
</template>
