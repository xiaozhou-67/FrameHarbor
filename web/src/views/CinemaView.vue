<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import type { Cinema, Hall } from '../../../shared/domain.ts';
import { api } from '../api.ts';
import { useResource } from '../composables/resource.ts';
import PageState from '../components/PageState.vue';
import ShowList from '../components/ShowList.vue';
import Icon from '../components/Icon.vue';
const route = useRoute();
const id = computed(() => Number(route.params.id));
const { data, loading, error, reload } = useResource(
  (signal) => api<{ cinema: Cinema; halls: Hall[] }>(`/cinemas/${id.value}`, { signal }),
  [id],
);
</script>
<template>
  <div class="container page-space">
    <RouterLink to="/cinemas" class="back-link">← 返回影院列表</RouterLink
    ><PageState :loading="loading" :error="error" @retry="reload"
      ><template v-if="data"
        ><section class="venue-hero">
          <div>
            <span class="eyebrow">{{ data.cinema.city }} / {{ data.cinema.district }}</span>
            <h1>{{ data.cinema.name }}</h1>
            <p class="muted"><Icon name="pin" :size="16" />{{ data.cinema.address }}</p>
            <p>{{ data.cinema.description }}</p>
            <div class="tags">
              <span v-for="tag in data.cinema.tags" :key="tag">{{ tag }}</span>
            </div>
          </div>
          <div class="venue-halls">
            <span class="eyebrow">OUR SCREENS</span>
            <div v-for="hall in data.halls" :key="hall.id">
              <strong>{{ hall.name }}</strong
              ><span>{{ hall.format }}</span
              ><small>{{ hall.rows * hall.columns }} 个座位</small>
            </div>
            <p v-if="!data.halls.length" class="muted">影厅筹备中</p>
          </div>
        </section>
        <section class="section-block">
          <div class="section-heading">
            <div>
              <span class="eyebrow">TODAY & BEYOND</span>
              <h2>在这里，选一场相遇</h2>
            </div>
            <span class="muted small">北京时间 · 提前 15 分钟停止售票</span>
          </div>
          <ShowList :cinema-id="id" /></section></template
    ></PageState>
  </div>
</template>
