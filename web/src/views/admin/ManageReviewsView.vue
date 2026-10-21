<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Page, Review } from '../../../../shared/domain.ts';
import { api, ApiError, messageOf } from '../../api.ts';
import { useResource } from '../../composables/resource.ts';
import { notify } from '../../state.ts';
import { dateTime } from '../../format.ts';
import PageState from '../../components/PageState.vue';
import Pager from '../../components/Pager.vue';
const page = ref(1);
const status = ref('pending');
const busy = ref<number | null>(null);
watch(status, () => {
  page.value = 1;
});
const { data, loading, error, reload } = useResource(
  (signal) => api<Page<Review>>(`/admin/reviews?page=${page.value}&status=${status.value}`, { signal }),
  [page, status],
);
async function moderate(review: Review, value: 'approved' | 'rejected') {
  busy.value = review.id;
  try {
    await api(`/admin/reviews/${review.id}`, {
      method: 'PUT',
      body: { status: value, revision: review.revision },
    });
    notify(value === 'approved' ? '影评已发布，用户评分同步更新' : '影评未通过，用户可修改后重新提交');
    await reload();
  } catch (e) {
    notify(messageOf(e), 'error');
    if (e instanceof ApiError && e.code === 'REVIEW_CHANGED') await reload();
  } finally {
    busy.value = null;
  }
}
</script>
<template>
  <header class="admin-page-heading">
    <div>
      <span class="eyebrow">LET GOOD CONVERSATIONS GROW</span>
      <h1>评论审核</h1>
      <p>仅已通过的影评公开展示并计入用户评分。</p>
    </div>
    <label class="inline-label"
      >状态<select v-model="status">
        <option value="pending">待审核</option>
        <option value="approved">已发布</option>
        <option value="rejected">未通过</option>
        <option value="all">全部</option>
      </select></label
    >
  </header>
  <PageState :loading="loading" :error="error" @retry="reload"
    ><template v-if="data"
      ><article v-for="review in data.items" :key="review.id" class="panel moderation-card">
        <div class="row-between">
          <div>
            <RouterLink :to="`/movies/${review.movieId}`"
              ><h3>{{ review.movieTitle }}</h3></RouterLink
            >
            <p class="small muted">{{ review.displayName }} · {{ dateTime(review.createdAt) }}</p>
          </div>
          <span class="rating">{{ review.rating }} / 10</span>
        </div>
        <p class="review-body">{{ review.content }}</p>
        <div class="row-between">
          <span class="badge" :class="review.status">{{
            { pending: '待审核', approved: '已发布', rejected: '未通过' }[review.status]
          }}</span>
          <div class="button-row">
            <button
              v-if="review.status !== 'rejected'"
              class="button secondary small-button"
              :disabled="busy !== null"
              @click="moderate(review, 'rejected')"
            >
              不通过</button
            ><button
              v-if="review.status !== 'approved'"
              class="button small-button"
              :disabled="busy !== null"
              @click="moderate(review, 'approved')"
            >
              通过并发布
            </button>
          </div>
        </div>
      </article>
      <div v-if="!data.items.length" class="empty-state">
        <span class="eyebrow">ALL CAUGHT UP</span>
        <h2>这里很安静。</h2>
        <p>当前分类下暂无评论。</p>
      </div>
      <Pager :page="page" :total="data.total" @change="page = $event" /></template
  ></PageState>
</template>
