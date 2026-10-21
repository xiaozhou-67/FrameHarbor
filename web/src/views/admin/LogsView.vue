<script setup lang="ts">
import { ref } from 'vue';
import type { AuditLog, Page } from '../../../../shared/domain.ts';
import { api } from '../../api.ts';
import { useResource } from '../../composables/resource.ts';
import { dateTime } from '../../format.ts';
import PageState from '../../components/PageState.vue';
import Pager from '../../components/Pager.vue';
const page = ref(1);
const { data, loading, error, reload } = useResource(
  (signal) => api<Page<AuditLog>>(`/admin/logs?page=${page.value}`, { signal }),
  [page],
);
const actions: Record<string, string> = {
  'movie.create': '新增影片',
  'movie.update': '编辑影片',
  'cinema.create': '新增影院',
  'cinema.update': '编辑影院',
  'hall.create': '新增影厅',
  'hall.update': '编辑影厅',
  'show.create': '新增排片',
  'show.cancel': '取消场次',
  'order.check-in': '核销订单',
  'review.moderate': '审核影评',
};
</script>
<template>
  <header class="admin-page-heading">
    <div>
      <span class="eyebrow">A CLEAR RECORD</span>
      <h1>操作记录</h1>
      <p>所有运营写入与业务记录在同一事务内留痕。</p>
    </div>
    <button class="button secondary small-button" @click="reload">刷新 ↻</button>
  </header>
  <PageState :loading="loading" :error="error" @retry="reload"
    ><template v-if="data"
      ><div class="table-scroll panel">
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>操作人</th>
              <th>操作</th>
              <th>目标</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in data.items" :key="log.id">
              <td>{{ dateTime(log.createdAt) }}</td>
              <td>{{ log.actorName }}</td>
              <td>{{ actions[log.action] ?? log.action }}</td>
              <td>
                <code>{{ log.target }}</code>
              </td>
              <td>{{ log.detail }}</td>
            </tr>
            <tr v-if="!data.items.length">
              <td colspan="5" class="center muted">暂无运营操作记录</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Pager :page="page" :total="data.total" @change="page = $event" /></template
  ></PageState>
</template>
