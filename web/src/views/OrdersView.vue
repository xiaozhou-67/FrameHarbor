<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue';
import { useRoute } from 'vue-router';
import { BUSINESS, ORDER_LABELS, type Order, type Page } from '../../../shared/domain.ts';
import { api, messageOf } from '../api.ts';
import { useResource } from '../composables/resource.ts';
import { confirmAction, notify } from '../state.ts';
import { countdown, date, money, seatLabel, time } from '../format.ts';
import PageState from '../components/PageState.vue';
import Icon from '../components/Icon.vue';
const route = useRoute();
const page = ref(1);
const filter = ref('all');
const busy = ref<string | null>(null);
const now = ref(Date.now());
const { data, loading, error, reload } = useResource(
  async (signal) => {
    const [orders, settings] = await Promise.all([
      api<Page<Order>>(`/orders?page=${page.value}&pageSize=20`, { signal }),
      api<{ demoPayments: boolean }>('/booking-config', { signal }),
    ]);
    return { orders, settings };
  },
  [page],
);
const orders = computed(() =>
  (data.value?.orders.items ?? [])
    .filter((o) => filter.value === 'all' || o.status === filter.value)
    .sort((a, b) => Number(b.id === route.query.focus) - Number(a.id === route.query.focus)),
);
let refreshingExpiry = false;
const interval = setInterval(() => {
  now.value = Date.now();
  if (
    !refreshingExpiry &&
    !busy.value &&
    data.value?.orders.items.some((o) => o.status === 'pending' && o.expiresAt <= now.value)
  ) {
    refreshingExpiry = true;
    void reload().finally(() => {
      refreshingExpiry = false;
    });
  }
}, 1000);
onScopeDispose(() => clearInterval(interval));
async function act(order: Order, action: 'pay' | 'cancel' | 'refund') {
  if (busy.value) return;
  const options = {
    pay: [
      '确认演示支付',
      `本次为模拟购票，确认后将模拟支付 ${money(order.totalCents)} 并生成取票码。`,
      '确认演示支付',
    ],
    cancel: ['取消这次预订？', '所选座位将立即释放，优惠码也会恢复可用。', '取消预订'],
    refund: ['确认退票？', `将整单退还 ${money(order.totalCents)} 的演示金额，并释放全部座位。`, '确认退票'],
  }[action]!;
  if (!(await confirmAction(options[0]!, options[1]!, options[2]!))) return;
  busy.value = order.id;
  try {
    const updated = await api<Order>(`/orders/${order.id}/${action}`, {
      method: 'POST',
      body: action === 'pay' ? { confirmDemo: true } : {},
    });
    if (data.value) {
      const index = data.value.orders.items.findIndex((o) => o.id === updated.id);
      if (index >= 0) data.value.orders.items[index] = updated;
      data.value = { ...data.value };
    }
    notify(
      action === 'pay' ? '演示支付成功，取票码已生成' : action === 'refund' ? '已完成整单退票' : '预订已取消',
    );
  } catch (e) {
    notify(messageOf(e), 'error');
    await reload();
  } finally {
    busy.value = null;
  }
}
async function copyTicket(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    notify('取票码已复制');
  } catch {
    notify(`取票码：${code}，请长按或选中文本复制`);
  }
}
</script>
<template>
  <div class="container page-space">
    <header class="page-heading">
      <div>
        <span class="eyebrow">YOUR TICKET TO ANOTHER WORLD</span>
        <h1>我的票夹</h1>
        <p>把值得期待的时刻，收在一起。</p>
      </div>
      <RouterLink to="/movies" class="button secondary">再选一场<Icon name="arrow" :size="18" /></RouterLink>
    </header>
    <div class="filter-chips">
      <button
        v-for="tab in [
          { key: 'all', label: '全部' },
          { key: 'pending', label: '待支付' },
          { key: 'paid', label: '已出票' },
          { key: 'refunded', label: '已退款' },
          { key: 'cancelled', label: '已取消' },
          { key: 'expired', label: '已超时' },
        ]"
        :key="tab.key"
        :class="{ active: filter === tab.key }"
        :aria-pressed="filter === tab.key"
        @click="filter = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>
    <PageState :loading="loading" :error="error" @retry="reload"
      ><template v-if="data"
        ><div v-if="!orders.length" class="empty-state">
          <Icon name="ticket" :size="40" />
          <h2>下一张票，还在等你。</h2>
          <p>当前页没有这类订单，去挑一个喜欢的故事吧。</p>
          <RouterLink to="/movies" class="button">发现好电影</RouterLink>
        </div>
        <div v-else class="orders-list">
          <article
            v-for="order in orders"
            :key="order.id"
            class="ticket-card"
            :class="{ 'focused-ticket': order.id === route.query.focus }"
          >
            <div class="ticket-main">
              <img :src="order.poster" :alt="order.movieTitle" width="110" height="154" />
              <div class="ticket-info">
                <div class="row-between">
                  <RouterLink :to="`/movies/${order.movieId}`"
                    ><h2>{{ order.movieTitle }}</h2></RouterLink
                  ><span class="badge" :class="order.status">{{
                    order.checkedInAt ? '已核销' : ORDER_LABELS[order.status]
                  }}</span>
                </div>
                <p>
                  {{ order.cinemaName }}<br /><span class="muted"
                    >{{ order.hallName }} · {{ order.format }}</span
                  >
                </p>
                <p class="ticket-time">
                  {{ date(order.startsAt) }} <strong>{{ time(order.startsAt) }}</strong>
                </p>
                <div class="tags">
                  <span v-for="seat in order.seats" :key="seat">{{ seatLabel(seat) }}</span>
                </div>
                <span class="order-number">订单 {{ order.id }}</span>
              </div>
            </div>
            <div class="ticket-stub">
              <template v-if="order.status === 'pending'"
                ><span class="eyebrow">SEATS RESERVED</span
                ><strong class="ticket-countdown">{{ countdown(order.expiresAt - now) }}</strong
                ><span class="small muted">剩余支付时间</span
                ><strong class="price">{{ money(order.totalCents) }}</strong
                ><button
                  class="button full-width"
                  :disabled="!!busy || order.expiresAt <= now || !data.settings.demoPayments"
                  @click="act(order, 'pay')"
                >
                  {{ busy === order.id ? '处理中…' : '演示支付' }}</button
                ><button class="text-button small muted" :disabled="!!busy" @click="act(order, 'cancel')">
                  取消预订
                </button></template
              ><template v-else-if="order.status === 'paid'"
                ><span class="eyebrow">ADMIT {{ order.seats.length }}</span>
                <div class="ticket-barcode" aria-hidden="true"></div>
                <button
                  v-if="order.ticketCode"
                  class="ticket-code"
                  aria-label="复制取票码"
                  @click="copyTicket(order.ticketCode)"
                >
                  {{ order.ticketCode }}</button
                ><span class="small muted">{{
                  order.checkedInAt ? '已核销 · 祝你观影愉快' : '凭取票码到影院核销'
                }}</span
                ><strong class="price">{{ money(order.totalCents) }}</strong
                ><button
                  v-if="!order.checkedInAt && order.startsAt - now >= BUSINESS.refundMinutes * 60000"
                  class="text-button small muted"
                  :disabled="!!busy"
                  @click="act(order, 'refund')"
                >
                  申请退票</button
                ><span v-else-if="!order.checkedInAt" class="small muted">{{
                  order.startsAt > now ? '已过自助退票时间' : '本场已开映'
                }}</span></template
              ><template v-else
                ><span class="eyebrow">UNTIL NEXT TIME</span><Icon name="ticket" :size="32" /><strong>{{
                  ORDER_LABELS[order.status]
                }}</strong
                ><span class="small muted">{{
                  order.status === 'refunded'
                    ? `已退还演示金额 ${money(order.totalCents)}`
                    : '座位与优惠已释放'
                }}</span
                ><RouterLink :to="`/movies/${order.movieId}`" class="text-link small"
                  >再选一场 →</RouterLink
                ></template
              >
            </div>
          </article>
        </div>
        <div v-if="data.orders.total > 20" class="pagination">
          <button :disabled="page <= 1" @click="page--">上一页</button
          ><span>{{ page }} / {{ Math.ceil(data.orders.total / 20) }}</span
          ><button :disabled="page * 20 >= data.orders.total" @click="page++">下一页</button>
        </div>
        <p class="small muted center">
          演示支付 · 所有场次按北京时间显示 · 开场前 45 分钟以上可整单退票 · 筛选作用于当前页
        </p></template
      ></PageState
    >
  </div>
</template>
