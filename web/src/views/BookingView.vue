<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Order, Quote, SeatMap } from '../../../shared/domain.ts';
import { api, ApiError, messageOf } from '../api.ts';
import { useResource } from '../composables/resource.ts';
import { date, money, seatLabel, time } from '../format.ts';
import { notify } from '../state.ts';
import PageState from '../components/PageState.vue';
import Icon from '../components/Icon.vue';
const route = useRoute();
const router = useRouter();
const id = computed(() => Number(route.params.id));
const selected = ref<string[]>([]);
const couponDraft = ref('');
const couponCode = ref('');
const suggestedCount = ref(2);
const reserving = ref(false);
let pageActive = true;
const { data, loading, error, reload } = useResource(
  async (signal) => {
    const [map, settings] = await Promise.all([
      api<SeatMap>(`/shows/${id.value}/seats`, { signal }),
      api<{ demoPayments: boolean }>('/booking-config', { signal }),
    ]);
    return { map, settings };
  },
  [id],
);
watch(id, () => {
  selected.value = [];
  couponCode.value = '';
  couponDraft.value = '';
});
const quote = shallowRef<Quote | null>(null);
const quoteError = ref('');
const quoting = ref(false);
let quoteTimer: ReturnType<typeof setTimeout> | undefined;
let quoteController: AbortController | null = null;
let quoteSequence = 0;
function requestQuote() {
  const sequence = ++quoteSequence;
  clearTimeout(quoteTimer);
  quoteController?.abort();
  quote.value = null;
  quoteError.value = '';
  if (!selected.value.length) {
    quoting.value = false;
    return;
  }
  quoting.value = true;
  quoteTimer = setTimeout(async () => {
    quoteController = new AbortController();
    try {
      const value = await api<Quote>('/orders/quote', {
        method: 'POST',
        body: { showId: id.value, seats: selected.value, couponCode: couponCode.value },
        signal: quoteController.signal,
      });
      if (sequence === quoteSequence) quote.value = value;
    } catch (e) {
      if (sequence === quoteSequence && !quoteController.signal.aborted) quoteError.value = messageOf(e);
    } finally {
      if (sequence === quoteSequence) quoting.value = false;
    }
  }, 250);
}
watch([selected, couponCode, id], requestQuote);
function toggleSeat(seat: string) {
  if (reserving.value) return;
  if (selected.value.includes(seat)) selected.value = selected.value.filter((s) => s !== seat);
  else if (selected.value.length < 4) selected.value = [...selected.value, seat];
  else notify('每单最多选择 4 个座位', 'error');
}
function suggest() {
  const map = data.value?.map;
  if (!map) return;
  const free = new Set(map.seats.filter((s) => s.state === 'available').map((s) => s.id));
  const count = suggestedCount.value;
  const middle = Math.floor(map.show.columns / 2);
  let best: { seats: string[]; score: number } | null = null;
  for (let r = 1; r <= map.show.rows; r++)
    for (let c = 1; c <= map.show.columns - count + 1; c++) {
      if (c <= middle && c + count - 1 > middle) continue;
      const seats = Array.from({ length: count }, (_, i) => `R${r}-C${c + i}`);
      if (!seats.every((s) => free.has(s))) continue;
      const score =
        Math.abs(r - map.show.rows * 0.62) * 2 + Math.abs(c + (count - 1) / 2 - (map.show.columns + 1) / 2);
      if (!best || score < best.score) best = { seats, score };
    }
  if (best) {
    selected.value = best.seats;
    notify(`已为你选择 ${count} 个靠近中部的连座`);
  } else notify('暂无合适连座，请手动选择或减少人数', 'error');
}
let refreshController: AbortController | null = null;
let refreshing = false;
async function refreshSeats() {
  if (!data.value || refreshing || reserving.value || document.hidden) return;
  const showId = id.value;
  refreshing = true;
  refreshController = new AbortController();
  try {
    const map = await api<SeatMap>(`/shows/${showId}/seats`, { signal: refreshController.signal });
    if (id.value !== showId || !data.value) return;
    data.value = { ...data.value, map };
    const free = new Set(map.seats.filter((s) => s.state === 'available').map((s) => s.id));
    const valid = selected.value.filter((s) => free.has(s));
    if (valid.length !== selected.value.length) {
      selected.value = valid;
      notify('部分座位状态已变化，请确认后继续', 'error');
    }
  } catch (e) {
    if (
      id.value === showId &&
      !refreshController.signal.aborted &&
      e instanceof ApiError &&
      (e.status === 404 || e.status === 409)
    ) {
      selected.value = [];
      error.value = e.message;
      data.value = null;
    }
  } finally {
    refreshing = false;
  }
}
const interval = setInterval(() => {
  void refreshSeats();
}, 12000);
onScopeDispose(() => {
  pageActive = false;
  clearInterval(interval);
  clearTimeout(quoteTimer);
  quoteSequence++;
  quoteController?.abort();
  refreshController?.abort();
});
async function reserve() {
  if (!quote.value || reserving.value) return;
  const bookingId = id.value;
  reserving.value = true;
  try {
    const order = await api<Order>('/orders', {
      method: 'POST',
      body: { showId: id.value, seats: selected.value, couponCode: couponCode.value },
    });
    if (pageActive && id.value === bookingId) {
      await router.push({ path: '/orders', query: { focus: order.id } });
      notify('座位已保留，请在倒计时结束前完成演示支付');
    } else notify('座位已保留，可前往「我的票夹」继续支付');
  } catch (e) {
    notify(messageOf(e), 'error');
    if (pageActive && id.value === bookingId && e instanceof ApiError && e.code === 'SEAT_TAKEN') {
      reserving.value = false;
      await refreshSeats();
    }
  } finally {
    reserving.value = false;
  }
}
</script>
<template>
  <div class="container page-space">
    <RouterLink :to="data ? `/movies/${data.map.show.movieId}` : '/movies'" class="back-link"
      >← 返回影片，选择其他场次</RouterLink
    ><PageState :loading="loading" :error="error" @retry="reload"
      ><template v-if="data"
        ><header class="booking-heading">
          <div>
            <span class="eyebrow">A BETTER SEAT, A BETTER STORY</span>
            <h1>选一个看故事的好位置。</h1>
            <p>{{ data.map.show.cinemaName }} · {{ data.map.show.hallName }} · {{ data.map.show.format }}</p>
          </div>
          <span class="badge mint"><Icon name="clock" :size="14" />锁座后保留 8 分钟</span>
        </header>
        <div class="booking-layout">
          <section class="seat-panel">
            <div class="screen"><span>银幕中央 / SCREEN</span></div>
            <div class="seat-legend">
              <span><i class="seat-sample available"></i>可选</span
              ><span><i class="seat-sample selected"></i>已选</span
              ><span><i class="seat-sample sold"></i>已售</span
              ><span><i class="seat-sample held"></i>保留中</span>
            </div>
            <div class="seat-scroll">
              <div
                class="seat-grid"
                :style="{ gridTemplateColumns: `20px repeat(${data.map.show.columns}, 28px)` }"
              >
                <template v-for="row in data.map.show.rows" :key="row"
                  ><span class="row-number">{{ row }}</span
                  ><button
                    v-for="seat in data.map.seats.filter((s) => s.row === row)"
                    :key="seat.id"
                    class="seat"
                    :class="[
                      seat.state,
                      {
                        selected: selected.includes(seat.id),
                        aisle: seat.column > Math.floor(data.map.show.columns / 2),
                      },
                    ]"
                    :disabled="seat.state !== 'available' || reserving"
                    :aria-label="`${seatLabel(seat.id)}，${{ available: '可选', held: '保留中', sold: '已售', mine: '你的待支付订单已保留' }[seat.state]}`"
                    :aria-pressed="selected.includes(seat.id)"
                    @click="toggleSeat(seat.id)"
                  >
                    <span>{{ selected.includes(seat.id) ? '✓' : seat.column }}</span>
                  </button></template
                >
              </div>
            </div>
            <div class="seat-assistant">
              <Icon name="spark" :size="20" /><span>不知道坐哪里？</span
              ><label class="sr-only" for="seat-count">推荐座位数量</label
              ><select id="seat-count" v-model.number="suggestedCount">
                <option v-for="n in 4" :key="n" :value="n">{{ n }} 人</option></select
              ><button class="text-button" :disabled="reserving" @click="suggest">帮我选连座 →</button
              ><button class="icon-button" aria-label="刷新座位" :disabled="reserving" @click="refreshSeats">
                ↻
              </button>
            </div>
            <p class="small muted center">每单最多 4 座 · 座位每 12 秒刷新 · 灰绿色座位已被其他订单保留</p>
          </section>
          <aside class="booking-summary form-card">
            <div class="summary-movie">
              <img :src="data.map.show.moviePoster" :alt="data.map.show.movieTitle" width="80" height="112" />
              <div>
                <span class="eyebrow">YOUR NEXT FRAME</span>
                <h2>{{ data.map.show.movieTitle }}</h2>
                <p>
                  {{ date(data.map.show.startsAt) }}<br /><strong>{{ time(data.map.show.startsAt) }}</strong>
                  · {{ data.map.show.format }}
                </p>
              </div>
            </div>
            <div class="summary-divider"></div>
            <h3 class="small">
              已选座位 <span class="muted">{{ selected.length }} / 4</span>
            </h3>
            <div class="selected-seats">
              <button
                v-for="seat in selected"
                :key="seat"
                :disabled="reserving"
                :aria-label="`取消${seatLabel(seat)}`"
                @click="toggleSeat(seat)"
              >
                {{ seatLabel(seat) }} ×</button
              ><span v-if="!selected.length" class="small muted">点击左侧座位，开始你的观影计划</span>
            </div>
            <label
              >优惠码<span class="coupon-input"
                ><input
                  v-model="couponDraft"
                  maxlength="30"
                  placeholder="试试 FIRSTFRAME"
                  :disabled="reserving"
                /><button
                  class="text-button"
                  :disabled="reserving"
                  @click="couponCode = couponDraft.trim().toUpperCase()"
                >
                  应用
                </button></span
              ></label
            ><button
              v-if="couponCode"
              class="text-button small"
              :disabled="reserving"
              @click="
                couponCode = '';
                couponDraft = '';
              "
            >
              移除 {{ couponCode }} ×
            </button>
            <p class="small muted">FIRSTFRAME：满 ¥60 减 ¥10，每人一次。</p>
            <div class="summary-divider"></div>
            <div class="price-lines">
              <span>票价</span><strong>{{ money(data.map.show.priceCents) }} × {{ selected.length }}</strong
              ><span>优惠</span
              ><strong class="mint-text">{{
                quote?.discountCents ? `−${money(quote.discountCents)}` : '—'
              }}</strong>
            </div>
            <div v-if="quoteError" class="form-error" role="alert">
              <p>{{ quoteError }}</p>
              <button class="text-button small" :disabled="quoting || reserving" @click="requestQuote">
                保留选择，重新计价 →
              </button>
            </div>
            <div class="summary-total">
              <span>合计</span
              ><strong>{{ quoting ? '计价中…' : quote ? money(quote.totalCents) : '—' }}</strong>
            </div>
            <button
              class="button full-width"
              :disabled="!quote || quoting || reserving || !data.settings.demoPayments"
              @click="reserve"
            >
              {{ reserving ? '正在保留座位…' : '保留座位，前往支付' }}<Icon name="arrow" :size="17" />
            </button>
            <p class="small muted">
              {{
                data.settings.demoPayments
                  ? '下一步为演示支付，无需真实付款。'
                  : '当前环境未启用演示支付，暂不开放下单。'
              }}<br />开场前 45 分钟以上可整单退票。
            </p>
          </aside>
        </div></template
      ></PageState
    >
  </div>
</template>
