<script setup lang="ts">
import type { Movie } from '../../../shared/domain.ts';
import { RouterLink } from 'vue-router';
import Icon from './Icon.vue';
defineProps<{ movie: Movie; reason?: string }>();
</script>
<template>
  <article class="movie-card">
    <component
      :is="movie.status === 'archived' ? 'div' : RouterLink"
      :to="movie.status === 'archived' ? undefined : `/movies/${movie.id}`"
      class="poster-link"
      :aria-label="`${movie.status === 'archived' ? '已归档' : '查看'}《${movie.title}》`"
    >
      <img :src="movie.poster" :alt="`${movie.title}原创概念海报`" loading="lazy" width="400" height="560" />
      <span class="poster-status">{{
        { soon: '即将上映', now: '正在热映', archived: '已归档' }[movie.status]
      }}</span>
      <span v-if="movie.status !== 'archived'" class="poster-action"
        >走进故事 <Icon name="arrow" :size="18"
      /></span>
    </component>
    <div class="movie-card-title">
      <h3 v-if="movie.status === 'archived'">{{ movie.title }}</h3>
      <RouterLink v-else :to="`/movies/${movie.id}`"
        ><h3>{{ movie.title }}</h3></RouterLink
      ><span class="rating"
        ><Icon name="star" :size="14" />{{ (movie.rating ?? movie.editorialScore).toFixed(1) }}</span
      >
    </div>
    <p class="muted small">
      {{ movie.genre }} <span class="dot">·</span> {{ movie.durationMinutes }} 分钟
      <span v-if="!movie.reviewCount" class="small">· 编辑精选</span>
    </p>
    <p v-if="reason" class="recommendation-reason"><Icon name="spark" :size="13" />{{ reason }}</p>
  </article>
</template>
