<script setup lang="ts">
import { computed } from 'vue';
import type { Dashboard } from '../../../../shared/domain.ts';
import { api } from '../../api.ts';
import { useResource } from '../../composables/resource.ts';
import { money } from '../../format.ts';
import PageState from '../../components/PageState.vue';
import Icon from '../../components/Icon.vue';
const { data, loading, error, reload } = useResource((signal) =>
  api<Dashboard>('/admin/dashboard', { signal }),
);
const maxRevenue = computed(() => Math.max(1, ...(data.value?.daily.map((d) => d.revenueCents) ?? [])));
</script>
<template>
  <header class="admin-page-heading">
    <div>
      <span class="eyebrow">THE BIG PICTURE</span>
      <h1>运营概览</h1>
      <p>每一张票背后，都是一次期待。</p>
    </div>
    <button class="button secondary small-button" @click="reload">刷新数据 ↻</button>
  </header>
  <PageState :loading="loading" :error="error" @retry="reload"
    ><template v-if="data"
      ><div class="metric-grid">
        <article class="metric-card">
          <span>累计有效票款 · 演示</span><strong>{{ money(data.revenueCents) }}</strong
          ><small>已支付订单总额，已扣除退款</small><Icon name="ticket" :size="26" />
        </article>
        <article class="metric-card">
          <span>累计售出票数</span><strong>{{ data.tickets }}<small> 张</small></strong
          ><small>{{ data.paidOrders }} 个有效订单</small><Icon name="film" :size="26" />
        </article>
        <article class="metric-card">
          <span>未来 7 天已售上座率</span><strong>{{ data.occupancyPercent }}<small> %</small></strong
          ><small>{{ data.activeShows }} 场开放排片</small><Icon name="grid" :size="26" />
        </article>
        <article class="metric-card">
          <span>等待审核的声音</span><strong>{{ data.pendingReviews }}<small> 条</small></strong
          ><RouterLink to="/admin/reviews" class="text-link small">前往审核 →</RouterLink
          ><Icon name="star" :size="26" />
        </article>
      </div>
      <div class="dashboard-columns">
        <section class="panel">
          <div class="section-heading">
            <div>
              <span class="eyebrow">LAST 7 DAYS</span>
              <h2>近 7 天票款</h2>
            </div>
            <span class="small muted">按付款日 · 北京时间</span>
          </div>
          <div
            class="revenue-chart"
            role="img"
            :aria-label="`近7天演示票款：${data.daily.map((d) => `${d.day} ${money(d.revenueCents)}`).join('；')}`"
          >
            <div v-for="day in data.daily" :key="day.day" class="chart-column">
              <span>{{ money(day.revenueCents) }}</span>
              <div class="chart-track">
                <i :style="{ height: `${Math.max(2, (day.revenueCents / maxRevenue) * 100)}%` }"></i>
              </div>
              <small>{{ day.day.slice(5) }}</small>
            </div>
          </div>
          <p v-if="data.daily.every((d) => d.orders === 0)" class="small muted center">
            暂无付款记录，完成演示订单后将在这里显示。
          </p>
        </section>
        <section class="panel">
          <div class="section-heading">
            <div>
              <span class="eyebrow">AUDIENCE FAVOURITES</span>
              <h2>热门影片</h2>
            </div>
          </div>
          <div v-for="(movie, index) in data.popular" :key="movie.title" class="popular-row">
            <span class="rank">0{{ index + 1 }}</span>
            <div>
              <h3>{{ movie.title }}</h3>
              <span class="small muted">{{ movie.tickets }} 张票</span>
            </div>
            <strong class="small">{{ money(movie.revenueCents) }}</strong>
          </div>
          <div v-if="!data.popular.length" class="empty-state compact">
            <Icon name="film" :size="28" />
            <p>等待第一位观众入场</p>
          </div>
        </section>
      </div>
      <section class="panel quick-actions">
        <div>
          <span class="eyebrow">SET THE NEXT SCENE</span>
          <h2>为下一场做好准备。</h2>
          <p class="muted">先完善影片与影厅，再安排场次，系统会自动校验时间冲突。</p>
        </div>
        <div class="button-row">
          <RouterLink to="/admin/movies" class="button secondary">管理影片</RouterLink
          ><RouterLink to="/admin/shows" class="button">安排新场次<Icon name="plus" :size="18" /></RouterLink>
        </div></section></template
  ></PageState>
</template>
