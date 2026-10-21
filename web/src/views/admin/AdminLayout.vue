<script setup lang="ts">
import Icon from '../../components/Icon.vue';
const links = [
  { path: '/admin', name: '运营概览', icon: 'grid' },
  { path: '/admin/movies', name: '影片管理', icon: 'film' },
  { path: '/admin/venues', name: '影院与影厅', icon: 'pin' },
  { path: '/admin/shows', name: '排片管理', icon: 'clock' },
  { path: '/admin/orders', name: '订单与核销', icon: 'ticket' },
  { path: '/admin/reviews', name: '评论审核', icon: 'star' },
  { path: '/admin/logs', name: '操作记录', icon: 'menu' },
];
</script>
<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <div class="admin-brand">
        <span class="eyebrow">FRAMEHARBOR STUDIO</span>
        <h2>影院运营台<span class="live-dot"></span></h2>
      </div>
      <nav aria-label="运营导航">
        <RouterLink
          v-for="link in links"
          :key="link.path"
          :to="link.path"
          :class="{ active: $route.path === link.path }"
          ><Icon :name="link.icon" :size="18" />{{ link.name }}</RouterLink
        >
      </nav>
      <div class="admin-sidebar-note">
        <Icon name="spark" :size="22" />
        <p>让每一场放映，<br />都井然有序。</p>
        <span>本地演示运营环境</span>
      </div>
    </aside>
    <div class="admin-content"><RouterView /></div>
  </div>
</template>
