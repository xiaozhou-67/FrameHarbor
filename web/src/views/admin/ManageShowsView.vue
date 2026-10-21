<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import type { Cinema, Hall, Movie, Page, Show } from '../../../../shared/domain.ts';
import { api, messageOf, query } from '../../api.ts';
import { useResource } from '../../composables/resource.ts';
import { confirmAction, notify } from '../../state.ts';
import { dateTime, money } from '../../format.ts';
import PageState from '../../components/PageState.vue';
import FormDialog from '../../components/FormDialog.vue';
import Pager from '../../components/Pager.vue';
import Icon from '../../components/Icon.vue';
const page = ref(1);
const status = ref('all');
const cinemaId = ref('');
const movieId = ref('');
watch([status, cinemaId, movieId], () => {
  page.value = 1;
});
const { data, loading, error, reload } = useResource(
  (signal) =>
    api<Page<Show>>(
      `/admin/shows${query({ page: page.value, status: status.value, cinemaId: cinemaId.value, movieId: movieId.value })}`,
      { signal },
    ),
  [page, status, cinemaId, movieId],
);
const catalog = useResource(async (signal) => {
  const [movies, halls, cinemas] = await Promise.all([
    api<Movie[]>('/admin/movies', { signal }),
    api<Hall[]>('/admin/halls', { signal }),
    api<Cinema[]>('/admin/cinemas', { signal }),
  ]);
  return { movies, halls, cinemas };
});
const open = ref(false);
const saving = ref(false);
const formError = ref('');
const actionId = ref<number | null>(null);
const form = reactive({ movieId: 0, hallId: 0, startsAt: '', priceYuan: 49 });
function add() {
  form.movieId = catalog.data.value?.movies.find((m) => m.status === 'now')?.id ?? 0;
  form.hallId = catalog.data.value?.halls[0]?.id ?? 0;
  form.startsAt = '';
  form.priceYuan = 49;
  formError.value = '';
  open.value = true;
}
async function save() {
  saving.value = true;
  formError.value = '';
  try {
    await api('/admin/shows', {
      method: 'POST',
      body: {
        movieId: form.movieId,
        hallId: form.hallId,
        startsAt: Date.parse(`${form.startsAt}+08:00`),
        priceCents: Math.round(form.priceYuan * 100),
      },
    });
    open.value = false;
    notify('排片已创建');
    await reload();
  } catch (e) {
    formError.value = messageOf(e);
  } finally {
    saving.value = false;
  }
}
async function cancel(show: Show) {
  if (
    actionId.value !== null ||
    !(await confirmAction(
      '确认取消场次？',
      `《${show.movieTitle}》${dateTime(show.startsAt)}，${show.hallName}。取消后会释放座位、关闭待支付订单，并退还已支付订单的演示金额。`,
      '取消场次并处理订单',
    ))
  )
    return;
  actionId.value = show.id;
  try {
    await api(`/admin/shows/${show.id}/cancel`, { method: 'POST' });
    notify('场次已取消，关联订单已处理');
    await reload();
  } catch (e) {
    notify(messageOf(e), 'error');
  } finally {
    actionId.value = null;
  }
}
</script>
<template>
  <header class="admin-page-heading">
    <div>
      <span class="eyebrow">SET THE NEXT SCENE</span>
      <h1>排片管理</h1>
      <p>北京时间排片，自动预留 20 分钟清场时间。</p>
    </div>
    <button
      class="button small-button"
      :disabled="
        !catalog.data.value?.halls.length || !catalog.data.value?.movies.some((m) => m.status === 'now')
      "
      @click="add"
    >
      <Icon name="plus" :size="18" />新增场次
    </button>
  </header>
  <p v-if="catalog.error.value" class="form-error">
    {{ catalog.error.value }} <button class="text-button" @click="catalog.reload">重试资料加载</button>
  </p>
  <div class="table-toolbar wrap">
    <label class="inline-label"
      >影院<select v-model="cinemaId">
        <option value="">全部影院</option>
        <option v-for="c in catalog.data.value?.cinemas ?? []" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select></label
    ><label class="inline-label"
      >影片<select v-model="movieId">
        <option value="">全部影片</option>
        <option v-for="m in catalog.data.value?.movies ?? []" :key="m.id" :value="m.id">{{ m.title }}</option>
      </select></label
    ><label class="inline-label"
      >状态<select v-model="status">
        <option value="all">全部状态</option>
        <option value="active">开放中</option>
        <option value="cancelled">已取消</option>
      </select></label
    >
  </div>
  <PageState :loading="loading" :error="error" @retry="reload"
    ><template v-if="data"
      ><div class="table-scroll panel">
        <table>
          <thead>
            <tr>
              <th>影片 / 场次</th>
              <th>影院 / 影厅</th>
              <th>开场 → 散场</th>
              <th>票价 / 余座</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="show in data.items" :key="show.id">
              <td>
                <strong>{{ show.movieTitle }}</strong
                ><small>#{{ show.id }} · {{ show.format }}</small>
              </td>
              <td>
                {{ show.cinemaName }}<small>{{ show.hallName }}</small>
              </td>
              <td>
                {{ dateTime(show.startsAt) }}<small>→ {{ dateTime(show.endsAt) }}</small>
              </td>
              <td>
                {{ money(show.priceCents)
                }}<small>{{ show.availableSeats }} / {{ show.rows * show.columns }} 余座</small>
              </td>
              <td>
                <span class="badge" :class="show.status">{{
                  show.status === 'cancelled' ? '已取消' : show.startsAt < Date.now() ? '历史场次' : '开放中'
                }}</span>
              </td>
              <td>
                <button
                  v-if="show.status === 'active' && show.startsAt > Date.now()"
                  class="text-button danger-text"
                  :disabled="actionId !== null"
                  @click="cancel(show)"
                >
                  {{ actionId === show.id ? '处理中…' : '取消场次' }}</button
                ><span v-else class="muted">—</span>
              </td>
            </tr>
            <tr v-if="!data.items.length">
              <td colspan="6" class="center muted">暂无匹配排片</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Pager :page="page" :total="data.total" @change="page = $event" /></template></PageState
  ><FormDialog :open="open" title="安排新的放映" :busy="saving" @close="open = false"
    ><form class="editor-form" @submit.prevent="save">
      <label
        >影片<select v-model.number="form.movieId" required>
          <option
            v-for="m in catalog.data.value?.movies.filter((m) => m.status === 'now') ?? []"
            :key="m.id"
            :value="m.id"
          >
            {{ m.title }} · {{ m.durationMinutes }} 分钟
          </option>
        </select></label
      ><label
        >影厅<select v-model.number="form.hallId" required>
          <option v-for="h in catalog.data.value?.halls ?? []" :key="h.id" :value="h.id">
            {{ catalog.data.value?.cinemas.find((c) => c.id === h.cinemaId)?.name }} / {{ h.name }} /
            {{ h.format }}
          </option>
        </select></label
      >
      <div class="form-grid">
        <label
          >开场时间（北京时间 UTC+8）<input v-model="form.startsAt" type="datetime-local" required /></label
        ><label
          >单座票价（元）<input
            v-model.number="form.priceYuan"
            type="number"
            min="1"
            max="1000"
            step="0.01"
            required
        /></label>
      </div>
      <div class="notice-card compact">
        <Icon name="clock" :size="18" />
        <p>
          散场时间根据影片时长计算。与现有场次前后均保留 20 分钟清场，时间重叠会被拒绝；排片范围为 15 分钟后至
          90 天内。
        </p>
      </div>
      <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
      <div class="dialog-actions">
        <button class="button secondary" type="button" :disabled="saving" @click="open = false">取消</button
        ><button class="button" :disabled="saving">{{ saving ? '校验并保存中…' : '创建场次' }}</button>
      </div>
    </form></FormDialog
  >
</template>
