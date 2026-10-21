<script setup lang="ts">
import { ref } from 'vue';
import type { Cinema } from '../../../shared/domain.ts';
import { api, query } from '../api.ts';
import { useResource } from '../composables/resource.ts';
import { money } from '../format.ts';
import PageState from '../components/PageState.vue';
import Icon from '../components/Icon.vue';
const city = ref('');
const q = ref('');
const search = ref('');
const { data, loading, error, reload } = useResource(
  (signal) => api<Cinema[]>(`/cinemas${query({ city: city.value, q: search.value })}`, { signal }),
  [city, search],
);
const meta = useResource((signal) => api<{ cities: string[] }>('/meta', { signal }));
</script>
<template>
  <div class="container page-space">
    <header class="page-heading">
      <div>
        <span class="eyebrow">YOUR NEIGHBOURHOOD SCREENS</span>
        <h1>电影开始前，先选一个好地方。</h1>
        <p>熟悉的城市，也有等待你发现的新银幕。</p>
      </div>
      <form class="search-box" role="search" @submit.prevent="search = q">
        <Icon name="search" /><input
          v-model="q"
          maxlength="100"
          placeholder="搜索影院、商圈…"
          aria-label="搜索影院"
        /><button class="icon-button" type="submit" aria-label="搜索"><Icon name="arrow" /></button>
      </form>
    </header>
    <div class="filter-chips">
      <button :class="{ active: !city }" :aria-pressed="!city" @click="city = ''">全部城市</button
      ><button
        v-for="c in meta.data.value?.cities ?? []"
        :key="c"
        :class="{ active: city === c }"
        :aria-pressed="city === c"
        @click="city = c"
      >
        {{ c }}
      </button>
    </div>
    <PageState :loading="loading" :error="error" @retry="reload"
      ><div v-if="!data?.length" class="empty-state">
        <h2>还没有找到这家光影客厅</h2>
        <p>换个关键词，看看城市里的其他影院。</p>
      </div>
      <div v-else class="venue-list">
        <article v-for="(cinema, index) in data" :key="cinema.id" class="venue-list-card">
          <div class="cinema-illustration" :class="`venue-${index % 3}`">
            <div class="cinema-building"><span>FRAMEHARBOR</span><i></i><i></i><i></i></div>
            <span class="cinema-city"
              >{{ cinema.city }}<small>{{ cinema.district }}</small></span
            >
          </div>
          <div class="venue-copy">
            <h2>{{ cinema.name }}</h2>
            <p class="muted"><Icon name="pin" :size="15" />{{ cinema.address }}</p>
            <p>{{ cinema.description }}</p>
            <div class="tags">
              <span v-for="tag in cinema.tags" :key="tag">{{ tag }}</span>
            </div>
          </div>
          <div class="venue-price">
            <span class="price">{{
              cinema.fromPriceCents ? `${money(cinema.fromPriceCents)} 起` : '暂无排片'
            }}</span
            ><RouterLink :to="`/cinemas/${cinema.id}`" class="button secondary"
              >查看场次<Icon name="arrow" :size="17"
            /></RouterLink>
          </div>
        </article></div
    ></PageState>
  </div>
</template>
