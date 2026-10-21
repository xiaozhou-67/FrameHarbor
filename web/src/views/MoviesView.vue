<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { GENRES, type Movie, type Page } from '../../../shared/domain.ts';
import { api, query } from '../api.ts';
import { useResource } from '../composables/resource.ts';
import MovieCard from '../components/MovieCard.vue';
import PageState from '../components/PageState.vue';
import Icon from '../components/Icon.vue';
const route = useRoute();
const router = useRouter();
const searchText = ref(String(route.query.q ?? ''));
const status = computed(() => String(route.query.status ?? 'now'));
const genre = computed(() => String(route.query.genre ?? 'all'));
const page = computed(() => Number(route.query.page ?? 1));
const sort = computed(() => String(route.query.sort ?? 'featured'));
const { data, loading, error, reload } = useResource(
  (signal) =>
    api<Page<Movie>>(
      `/movies${query({ q: String(route.query.q ?? ''), status: status.value, genre: genre.value, sort: sort.value, page: page.value, pageSize: 12 })}`,
      { signal },
    ),
  [() => route.fullPath],
);
function filter(values: Record<string, string | number>) {
  void router.replace({ path: '/movies', query: { ...route.query, page: 1, ...values } });
}
</script>
<template>
  <div class="container page-space">
    <header class="page-heading">
      <div>
        <span class="eyebrow">FIND YOUR NEXT STORY</span>
        <h1>今天，想走进哪个世界？</h1>
        <p>跟随心情，挑选一段属于你的银幕时光。</p>
      </div>
      <form class="search-box" role="search" @submit.prevent="filter({ q: searchText })">
        <Icon name="search" /><input
          v-model="searchText"
          maxlength="100"
          placeholder="搜索片名、导演…"
          aria-label="搜索电影"
        /><button class="icon-button" type="submit" aria-label="开始搜索">
          <Icon name="arrow" :size="18" />
        </button>
      </form>
    </header>
    <div class="catalog-toolbar">
      <div class="segment-tabs">
        <button
          v-for="tab in [
            { key: 'now', label: '正在热映' },
            { key: 'soon', label: '即将上映' },
            { key: 'all', label: '全部片单' },
          ]"
          :key="tab.key"
          :class="{ active: status === tab.key }"
          :aria-pressed="status === tab.key"
          @click="filter({ status: tab.key })"
        >
          {{ tab.label }}
        </button>
      </div>
      <label class="inline-label"
        >排序<select :value="sort" @change="filter({ sort: ($event.target as HTMLSelectElement).value })">
          <option value="featured">编辑精选</option>
          <option value="rating">评分优先</option>
          <option value="release">上映时间</option>
        </select></label
      >
    </div>
    <div class="filter-chips">
      <button
        :class="{ active: genre === 'all' }"
        :aria-pressed="genre === 'all'"
        @click="filter({ genre: 'all' })"
      >
        全部类型</button
      ><button
        v-for="g in GENRES"
        :key="g"
        :class="{ active: genre === g }"
        :aria-pressed="genre === g"
        @click="filter({ genre: g })"
      >
        {{ g }}
      </button>
    </div>
    <PageState :loading="loading" :error="error" @retry="reload"
      ><template v-if="data"
        ><p class="results-label">
          找到 {{ data.total }} 个故事 <span v-if="route.query.q">·「{{ route.query.q }}」</span>
        </p>
        <div v-if="data.items.length" class="movie-grid catalog-grid">
          <MovieCard v-for="movie in data.items" :key="movie.id" :movie="movie" />
        </div>
        <div v-else class="empty-state">
          <Icon name="film" :size="36" />
          <h2>这个故事还在路上</h2>
          <p>换个关键词或类型，或浏览全部片单。</p>
          <button
            class="button secondary"
            @click="
              searchText = '';
              filter({ q: '', genre: 'all', status: 'all' });
            "
          >
            重置筛选
          </button>
        </div>
        <div v-if="data.total > 12" class="pagination">
          <button :disabled="page <= 1" @click="filter({ page: page - 1 })">上一页</button
          ><span>{{ page }} / {{ Math.ceil(data.total / 12) }}</span
          ><button :disabled="page * 12 >= data.total" @click="filter({ page: page + 1 })">下一页</button>
        </div></template
      ></PageState
    >
  </div>
</template>
