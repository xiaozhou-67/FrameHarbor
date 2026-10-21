<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Movie, Page, Review } from '../../../shared/domain.ts';
import { api, messageOf } from '../api.ts';
import { auth, notify } from '../state.ts';
import { useResource } from '../composables/resource.ts';
import { dateTime } from '../format.ts';
import Icon from '../components/Icon.vue';
import PageState from '../components/PageState.vue';
import ShowList from '../components/ShowList.vue';
const route = useRoute();
const router = useRouter();
const id = computed(() => Number(route.params.id));
const reviewPage = ref(1);
const { data, loading, error, reload } = useResource(
  async (signal) => {
    const [movie, reviews, mine] = await Promise.all([
      api<Movie>(`/movies/${id.value}`, { signal }),
      api<Page<Review>>(`/movies/${id.value}/reviews?page=${reviewPage.value}&pageSize=10`, { signal }),
      auth.user ? api<Review[]>('/me/reviews', { signal }) : Promise.resolve([]),
    ]);
    return { movie, reviews, mine: mine.find((r) => r.movieId === id.value) };
  },
  [id, reviewPage, () => auth.user?.id],
);
const watching = ref(false);
const posting = ref(false);
const content = ref('');
const rating = ref(8);
watch(id, () => {
  reviewPage.value = 1;
});
watch(data, (value) => {
  if (value) {
    content.value = value.mine?.content ?? '';
    rating.value = value.mine?.rating ?? 8;
  }
});
async function toggleWatch() {
  if (!auth.user) {
    await router.push({ path: '/login', query: { next: route.fullPath } });
    return;
  }
  if (!data.value) return;
  watching.value = true;
  const movie = data.value.movie;
  try {
    await api(`/me/watchlist/${movie.id}`, { method: movie.watchlisted ? 'DELETE' : 'PUT' });
    movie.watchlisted = !movie.watchlisted;
    notify(movie.watchlisted ? '已加入想看清单' : '已移出想看清单');
  } catch (e) {
    notify(messageOf(e), 'error');
  } finally {
    watching.value = false;
  }
}
async function postReview() {
  posting.value = true;
  try {
    await api(`/me/reviews/${id.value}`, {
      method: 'PUT',
      body: { rating: rating.value, content: content.value },
    });
    notify('影评已提交，审核后会与大家见面');
    await reload();
  } catch (e) {
    notify(messageOf(e), 'error');
  } finally {
    posting.value = false;
  }
}
</script>
<template>
  <div class="container page-space">
    <RouterLink to="/movies" class="back-link">← 返回电影片单</RouterLink
    ><PageState :loading="loading" :error="error" @retry="reload"
      ><template v-if="data"
        ><section class="movie-detail" :style="{ '--film-accent': data.movie.accent }">
          <img
            class="detail-poster"
            :src="data.movie.poster"
            :alt="data.movie.title"
            width="400"
            height="560"
          />
          <div class="detail-copy">
            <span class="eyebrow"
              >{{ data.movie.status === 'soon' ? 'COMING SOON' : 'NOW SHOWING' }} /
              {{ data.movie.genre }}</span
            >
            <h1>{{ data.movie.title }}</h1>
            <p class="english-title">{{ data.movie.englishTitle }}</p>
            <div class="detail-meta">
              <span>{{ data.movie.durationMinutes }} 分钟</span><span>{{ data.movie.language }}</span
              ><span>{{ data.movie.releaseDate }} 上映</span>
            </div>
            <div class="detail-score">
              <Icon name="star" :size="24" /><strong>{{
                (data.movie.rating ?? data.movie.editorialScore).toFixed(1)
              }}</strong
              ><span>{{
                data.movie.reviewCount ? `${data.movie.reviewCount} 位观众评分` : '帧港编辑精选指数'
              }}</span>
            </div>
            <p class="synopsis">{{ data.movie.synopsis }}</p>
            <p class="muted small">
              导演 / {{ data.movie.director }}<br />主演 / {{ data.movie.cast.join('、') }}
            </p>
            <div class="button-row">
              <a v-if="data.movie.status === 'now'" href="#showtimes" class="button"
                >选场购票<Icon name="ticket" :size="18" /></a
              ><button class="button secondary" :disabled="watching" @click="toggleWatch">
                <Icon name="heart" :size="18" />{{ data.movie.watchlisted ? '已在想看清单' : '加入想看' }}
              </button>
            </div>
          </div>
          <span class="detail-decoration" aria-hidden="true">FH.</span>
        </section>
        <section v-if="data.movie.status === 'now'" id="showtimes" class="section-block scroll-target">
          <div class="section-heading">
            <div>
              <span class="eyebrow">CHOOSE YOUR SCREENING</span>
              <h2>选一个刚刚好的时间</h2>
            </div>
            <span class="muted small">所有场次时间均为北京时间</span>
          </div>
          <ShowList :movie-id="id" />
        </section>
        <section v-else class="notice-card">
          <Icon name="clock" />
          <div>
            <h3>好故事，值得等一等。</h3>
            <p>影片即将上映，先加入想看，排片上线后再来相遇。</p>
          </div>
        </section>
        <section class="section-block reviews-section">
          <div>
            <div class="section-heading">
              <div>
                <span class="eyebrow">AFTER THE CREDITS</span>
                <h2>散场之后，聊聊感受</h2>
              </div>
              <span class="muted small">{{ data.reviews.total }} 条影评</span>
            </div>
            <article v-for="review in data.reviews.items" :key="review.id" class="review-card">
              <div class="review-header">
                <span class="avatar">{{ review.displayName.slice(0, 1) }}</span
                ><strong>{{ review.displayName }}</strong
                ><span class="rating"><Icon name="star" :size="14" />{{ review.rating }} / 10</span>
              </div>
              <p>{{ review.content }}</p>
              <small class="muted">{{ dateTime(review.createdAt) }}</small>
            </article>
            <div v-if="!data.reviews.items.length" class="empty-state compact">
              <p>银幕的回声，等你写下第一句。</p>
            </div>
            <div v-if="data.reviews.total > 10" class="pagination">
              <button :disabled="reviewPage <= 1" @click="reviewPage--">上一页</button
              ><span>{{ reviewPage }} / {{ Math.ceil(data.reviews.total / 10) }}</span
              ><button :disabled="reviewPage * 10 >= data.reviews.total" @click="reviewPage++">下一页</button>
            </div>
          </div>
          <form v-if="auth.user" class="form-card review-form" @submit.prevent="postReview">
            <h3>{{ data.mine ? '更新我的影评' : '写下你的观影感受' }}</h3>
            <p v-if="data.mine" class="small muted">
              当前状态：{{
                { pending: '待审核', approved: '已发布', rejected: '未通过，请修改后提交' }[data.mine.status]
              }}
            </p>
            <label
              >你的评分<select v-model.number="rating">
                <option v-for="n in 10" :key="n" :value="n">{{ n }} / 10</option>
              </select></label
            ><label
              >你的影评<textarea
                v-model="content"
                rows="5"
                minlength="20"
                maxlength="1000"
                required
                placeholder="哪一个瞬间，让你记住了这部电影？（至少 20 字）"
              ></textarea></label
            ><span class="small muted">{{ content.length }} / 1000 · 审核通过后公开</span
            ><button class="button" :disabled="posting">{{ posting ? '正在提交…' : '提交影评' }}</button>
          </form>
          <div v-else class="form-card">
            <h3>你的感受，也值得被听见。</h3>
            <p class="muted">登录后留下评分与影评。</p>
            <RouterLink :to="{ path: '/login', query: { next: route.fullPath } }" class="button secondary"
              >登录，聊一聊</RouterLink
            >
          </div>
        </section></template
      ></PageState
    >
  </div>
</template>
