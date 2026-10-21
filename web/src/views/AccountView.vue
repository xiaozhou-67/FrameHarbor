<script setup lang="ts">
import { reactive, ref } from 'vue';
import { GENRES, type Movie, type Review, type User } from '../../../shared/domain.ts';
import { api, messageOf } from '../api.ts';
import { useResource } from '../composables/resource.ts';
import { auth, notify, updateUser } from '../state.ts';
import { dateTime } from '../format.ts';
import MovieCard from '../components/MovieCard.vue';
import PageState from '../components/PageState.vue';
import Icon from '../components/Icon.vue';
const profile = reactive({
  displayName: auth.user?.displayName ?? '',
  genres: [...(auth.user?.genres ?? [])],
});
const saving = ref(false);
const { data, loading, error, reload } = useResource(async (signal) => {
  const [movies, reviews] = await Promise.all([
    api<Movie[]>('/me/watchlist', { signal }),
    api<Review[]>('/me/reviews', { signal }),
  ]);
  return { movies, reviews };
});
async function save() {
  saving.value = true;
  try {
    updateUser(await api<User>('/me/profile', { method: 'PUT', body: profile }));
    notify('偏好已更新，推荐片单也会随你而变');
  } catch (e) {
    notify(messageOf(e), 'error');
  } finally {
    saving.value = false;
  }
}
const removing = ref<number | null>(null);
async function remove(id: number) {
  removing.value = id;
  try {
    await api(`/me/watchlist/${id}`, { method: 'DELETE' });
    await reload();
    notify('已移出想看清单');
  } catch (e) {
    notify(messageOf(e), 'error');
  } finally {
    removing.value = null;
  }
}
</script>
<template>
  <div class="container page-space">
    <header class="account-heading">
      <span class="avatar large">{{ auth.user?.displayName.slice(0, 1) }}</span>
      <div>
        <span class="eyebrow">YOUR PERSONAL SCREEN</span>
        <h1>{{ auth.user?.displayName }} 的光影角落</h1>
        <p class="muted">{{ auth.user?.email }}</p>
      </div>
      <RouterLink to="/orders" class="button secondary"
        ><Icon name="ticket" :size="18" />打开我的票夹</RouterLink
      >
    </header>
    <div class="account-layout">
      <div>
        <PageState :loading="loading" :error="error" @retry="reload"
          ><template v-if="data"
            ><section>
              <div class="section-heading">
                <div>
                  <span class="eyebrow">ON YOUR WATCHLIST</span>
                  <h2>
                    留给下一次的心动 <span class="count">{{ data.movies.length }}</span>
                  </h2>
                </div>
              </div>
              <div v-if="data.movies.length" class="movie-grid watchlist-grid">
                <div v-for="movie in data.movies" :key="movie.id">
                  <MovieCard :movie="movie" /><button
                    class="text-button muted small remove-watch"
                    :disabled="removing !== null"
                    @click="remove(movie.id)"
                  >
                    {{ removing === movie.id ? '移除中…' : '移出想看' }}
                  </button>
                </div>
              </div>
              <div v-else class="empty-state compact">
                <Icon name="heart" :size="30" />
                <h3>先存下那些让你心动的片名</h3>
                <RouterLink to="/movies" class="text-link"
                  >去发现好电影 <Icon name="arrow" :size="17"
                /></RouterLink>
              </div>
            </section>
            <section class="section-block">
              <div class="section-heading">
                <div>
                  <span class="eyebrow">YOUR WORDS, AFTER THE FILM</span>
                  <h2>我的影评</h2>
                </div>
              </div>
              <article v-for="review in data.reviews" :key="review.id" class="review-card">
                <div class="review-header">
                  <RouterLink :to="`/movies/${review.movieId}`"
                    ><strong>{{ review.movieTitle }}</strong></RouterLink
                  ><span class="badge" :class="review.status">{{
                    { pending: '待审核', approved: '已发布', rejected: '请修改' }[review.status]
                  }}</span
                  ><span class="rating">{{ review.rating }} / 10</span>
                </div>
                <p>{{ review.content }}</p>
                <div class="row-between small">
                  <span class="muted">{{ dateTime(review.createdAt) }}</span
                  ><RouterLink :to="`/movies/${review.movieId}`" class="text-link">修改影评 →</RouterLink>
                </div>
              </article>
              <p v-if="!data.reviews.length" class="muted">还没有影评，散场后欢迎回来聊聊。</p>
            </section></template
          ></PageState
        >
      </div>
      <aside>
        <form class="form-card sticky-card" @submit.prevent="save">
          <span class="eyebrow">TUNE YOUR TASTE</span>
          <h3>让推荐更懂你</h3>
          <label>昵称<input v-model="profile.displayName" required minlength="2" maxlength="30" /></label>
          <fieldset>
            <legend>喜欢的电影类型</legend>
            <div class="preference-grid">
              <label v-for="genre in GENRES" :key="genre" class="check-chip"
                ><input v-model="profile.genres" type="checkbox" :value="genre" /><span>{{
                  genre
                }}</span></label
              >
            </div>
          </fieldset>
          <p class="small muted">片单根据你选择的类型与想看清单排序，推荐理由清晰可见。</p>
          <button class="button full-width" :disabled="saving">
            {{ saving ? '保存中…' : '保存观影偏好' }}
          </button>
        </form>
      </aside>
    </div>
  </div>
</template>
