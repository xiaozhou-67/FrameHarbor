<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Page, Show } from '../../../shared/domain.ts';
import { api, query } from '../api.ts';
import { useResource } from '../composables/resource.ts';
import { money, nextDays, time } from '../format.ts';
import PageState from './PageState.vue';
import Icon from './Icon.vue';
const props = defineProps<{ movieId?: number; cinemaId?: number }>();
const days = nextDays();
const day = ref(days[0]!.key);
const page = ref(1);
const { data, loading, error, reload } = useResource(
  (signal) =>
    api<Page<Show>>(
      `/shows${query({ movieId: props.movieId, cinemaId: props.cinemaId, day: day.value, page: page.value, pageSize: 12 })}`,
      { signal },
    ),
  [() => props.movieId, () => props.cinemaId, day, page],
);
const pages = computed(() => Math.ceil((data.value?.total ?? 0) / 12));
function chooseDay(value: string) {
  page.value = 1;
  day.value = value;
}
</script>
<template>
  <div class="date-tabs" aria-label="观影日期">
    <button
      v-for="d in days"
      :key="d.key"
      :class="{ active: day === d.key }"
      :aria-pressed="day === d.key"
      @click="chooseDay(d.key)"
    >
      <span>{{ d.label }}</span
      ><small>{{ d.short }}</small>
    </button>
  </div>
  <PageState :loading="loading" :error="error" @retry="reload">
    <div v-if="!data?.items.length" class="empty-state compact">
      <h3>这一天，银幕稍作休息</h3>
      <p>试试其他日期，或回来看看新的排片。</p>
    </div>
    <div v-else class="show-list">
      <article v-for="show in data.items" :key="show.id" class="show-row">
        <div class="show-time">
          <strong>{{ time(show.startsAt) }}</strong
          ><span>{{ time(show.endsAt) }} 散场</span>
        </div>
        <div class="show-venue">
          <h3>{{ cinemaId ? show.movieTitle : show.cinemaName }}</h3>
          <p class="muted small">
            {{ show.hallName }} · {{ show.format }} · {{ show.availableSeats }} 个余座
          </p>
        </div>
        <strong class="price">{{ money(show.priceCents) }}</strong>
        <RouterLink
          :to="`/booking/${show.id}`"
          class="button small-button"
          :aria-label="`选择${time(show.startsAt)}场座位`"
          >选座 <Icon name="arrow" :size="16"
        /></RouterLink>
      </article>
    </div>
    <div v-if="pages > 1" class="pagination">
      <button :disabled="page <= 1" @click="page--">上一页</button><span>{{ page }} / {{ pages }}</span
      ><button :disabled="page >= pages" @click="page++">下一页</button>
    </div>
  </PageState>
</template>
