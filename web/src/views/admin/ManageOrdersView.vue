<script setup lang="ts">
import { ref, watch } from 'vue';
import { ORDER_LABELS, type Order, type Page } from '../../../../shared/domain.ts';
import { api, messageOf, query } from '../../api.ts';
import { useResource } from '../../composables/resource.ts';
import { confirmAction, notify } from '../../state.ts';
import { dateTime, money, seatLabel } from '../../format.ts';
import PageState from '../../components/PageState.vue';
import Pager from '../../components/Pager.vue';
import Icon from '../../components/Icon.vue';
const page = ref(1);
const status = ref('all');
const q = ref('');
const search = ref('');
const busy = ref<string | null>(null);
watch([status, search], () => {
  page.value = 1;
});
const { data, loading, error, reload } = useResource(
  (signal) =>
    api<Page<Order>>(`/admin/orders${query({ page: page.value, status: status.value, q: search.value })}`, {
      signal,
    }),
  [page, status, search],
);
async function checkIn(order: Order) {
  if (
    busy.value ||
    !(await confirmAction(
      '核销这张票？',
      `${order.movieTitle}，${order.seats.map(seatLabel).join('、')}，取票码 ${order.ticketCode}。核销后用户无法自助退票。`,
      '确认核销',
    ))
  )
    return;
  busy.value = order.id;
  try {
    await api(`/admin/orders/${order.id}/check-in`, { method: 'POST' });
    notify('核销成功，祝观影愉快');
    await reload();
  } catch (e) {
    notify(messageOf(e), 'error');
  } finally {
    busy.value = null;
  }
}
</script>
<template>
  <header class="admin-page-heading">
    <div>
      <span class="eyebrow">EVERY TICKET COUNTS</span>
      <h1>订单与核销</h1>
      <p>核销窗口：开场前 2 小时至散场后 30 分钟。</p>
    </div>
    <button class="button secondary small-button" @click="reload">刷新 ↻</button>
  </header>
  <div class="table-toolbar wrap">
    <form class="search-box" role="search" @submit.prevent="search = q">
      <Icon name="search" :size="18" /><input
        v-model="q"
        maxlength="100"
        placeholder="取票码 / 订单号 / 片名 / 昵称"
        aria-label="搜索订单"
      /><button class="icon-button" type="submit" aria-label="搜索"><Icon name="arrow" :size="17" /></button>
    </form>
    <label class="inline-label"
      >状态<select v-model="status">
        <option value="all">全部订单</option>
        <option v-for="(label, key) in ORDER_LABELS" :key="key" :value="key">{{ label }}</option>
      </select></label
    >
  </div>
  <PageState :loading="loading" :error="error" @retry="reload"
    ><template v-if="data"
      ><div class="table-scroll panel">
        <table>
          <thead>
            <tr>
              <th>订单 / 取票码</th>
              <th>观众 / 影片</th>
              <th>场次 / 座位</th>
              <th>金额</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in data.items" :key="order.id">
              <td>
                <code>{{ order.id.slice(0, 8) }}…</code><small>{{ order.ticketCode ?? '未出票' }}</small>
              </td>
              <td>
                <strong>{{ order.movieTitle }}</strong
                ><small>{{ order.displayName }}</small>
              </td>
              <td>
                {{ dateTime(order.startsAt)
                }}<small>{{ order.hallName }} · {{ order.seats.map(seatLabel).join('、') }}</small
                ><small>{{ order.cinemaName }}</small>
              </td>
              <td>
                {{ money(order.totalCents)
                }}<small v-if="order.discountCents">优惠 {{ money(order.discountCents) }}</small>
              </td>
              <td>
                <span class="badge" :class="order.status">{{
                  order.checkedInAt ? '已核销' : ORDER_LABELS[order.status]
                }}</span>
              </td>
              <td>
                <button
                  v-if="order.status === 'paid' && !order.checkedInAt"
                  class="text-button"
                  :disabled="
                    !!busy || Date.now() < order.startsAt - 7200000 || Date.now() > order.endsAt + 1800000
                  "
                  @click="checkIn(order)"
                >
                  {{ busy === order.id ? '核销中…' : '核销入场' }}</button
                ><span v-else class="muted small">{{
                  order.checkedInAt ? dateTime(order.checkedInAt) : '—'
                }}</span>
              </td>
            </tr>
            <tr v-if="!data.items.length">
              <td colspan="6" class="center muted">暂无匹配订单</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Pager :page="page" :total="data.total" @change="page = $event" /></template
  ></PageState>
  <p class="small muted">所有金额为本地演示金额。已退款订单保留完整记录，取消场次请到排片管理操作。</p>
</template>
