<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { auth, ensureSession, logout, notify, toasts } from './state.ts';
import { messageOf } from './api.ts';
import Icon from './components/Icon.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
const route = useRoute();
const router = useRouter();
const menu = ref(false);
const leaving = ref(false);
watch(
  () => route.fullPath,
  () => {
    menu.value = false;
  },
);
async function signOut() {
  leaving.value = true;
  try {
    await logout();
    notify('已退出登录，下次银幕见');
    await router.push('/');
  } catch (e) {
    notify(messageOf(e), 'error');
  } finally {
    leaving.value = false;
  }
}
</script>
<template>
  <a href="#main" class="skip-link">跳到主要内容</a>
  <header class="site-header">
    <div class="header-inner">
      <RouterLink to="/" class="brand" aria-label="帧港首页"
        ><span class="brand-mark">f<span>.</span></span
        ><span class="brand-type">帧港<small>FRAMEHARBOR</small></span></RouterLink
      >
      <nav class="desktop-nav" aria-label="主导航">
        <RouterLink to="/" exact-active-class="selected">发现</RouterLink
        ><RouterLink to="/movies" active-class="selected">电影</RouterLink
        ><RouterLink to="/cinemas" active-class="selected">影院</RouterLink
        ><RouterLink to="/orders" active-class="selected">我的票夹</RouterLink>
      </nav>
      <div class="header-actions">
        <span class="location-pill"><Icon name="pin" :size="14" /> 杭州 / 上海</span
        ><RouterLink to="/movies" class="icon-button search-link" aria-label="搜索电影"
          ><Icon name="search" /></RouterLink
        ><template v-if="auth.user"
          ><RouterLink to="/account" class="account-link"
            ><span class="avatar">{{ auth.user.displayName.slice(0, 1) }}</span
            ><span>{{ auth.user.displayName }}</span></RouterLink
          ><RouterLink v-if="auth.user.role === 'admin'" to="/admin" class="admin-entry">运营台</RouterLink
          ><button class="icon-button signout" :disabled="leaving" aria-label="退出登录" @click="signOut">
            <Icon name="logout" :size="18" /></button></template
        ><RouterLink v-else to="/login" class="button small-button secondary">登录 / 加入</RouterLink
        ><button
          class="icon-button mobile-toggle"
          aria-label="展开导航"
          :aria-expanded="menu"
          @click="menu = !menu"
        >
          <Icon :name="menu ? 'close' : 'menu'" />
        </button>
      </div>
    </div>
    <nav v-if="menu" class="mobile-nav" aria-label="移动导航">
      <RouterLink to="/">发现</RouterLink><RouterLink to="/movies">电影</RouterLink
      ><RouterLink to="/cinemas">影院</RouterLink><RouterLink to="/orders">我的票夹</RouterLink
      ><RouterLink to="/account">我的帧港</RouterLink>
      <button v-if="auth.user" class="text-button" :disabled="leaving" @click="signOut">退出登录</button>
    </nav>
  </header>
  <div v-if="auth.error" class="connection-banner" role="alert">
    {{ auth.error }} <button class="text-button" @click="ensureSession(true)">重新连接</button>
  </div>
  <main id="main" tabindex="-1"><RouterView /></main>
  <footer class="site-footer">
    <div class="container footer-content">
      <div>
        <RouterLink to="/" class="footer-brand">帧港 <span>FRAMEHARBOR</span></RouterLink>
        <p>把今晚，留给大银幕。</p>
      </div>
      <div class="footer-note">
        <span>一张电影票，一段属于你的时间。</span><small>本地演示项目 · 影片与影院均为虚构 · 演示支付</small
        ><a href="/license.txt">GPL-3.0 · 来源与许可</a>
      </div>
    </div>
  </footer>
  <div class="toast-stack" aria-live="polite" aria-atomic="false">
    <div v-for="toast in toasts" :key="toast.id" class="toast" :class="toast.kind">
      <Icon :name="toast.kind === 'success' ? 'check' : 'close'" :size="18" /><span>{{ toast.message }}</span>
    </div>
  </div>
  <ConfirmDialog />
</template>
