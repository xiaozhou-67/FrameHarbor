<script setup lang="ts">
import { computed } from 'vue';
import type { Page, Movie, Recommendation, Cinema } from '../../../shared/domain.ts';
import { api } from '../api.ts';
import { useResource } from '../composables/resource.ts';
import { money } from '../format.ts';
import { auth } from '../state.ts';
import MovieCard from '../components/MovieCard.vue';
import PageState from '../components/PageState.vue';
import Icon from '../components/Icon.vue';
const { data, loading, error, reload } = useResource(
  async (signal) => {
    const [movies, recommendations, cinemas] = await Promise.all([
      api<Page<Movie>>('/movies?pageSize=6', { signal }),
      api<Recommendation[]>('/recommendations', { signal }),
      api<Cinema[]>('/cinemas', { signal }),
    ]);
    return { movies, recommendations, cinemas };
  },
  [() => auth.user?.id],
);
const featured = computed(
  () => data.value?.movies.items.find((m) => m.featured) ?? data.value?.movies.items[0],
);
</script>
<template>
  <section class="hero">
    <div class="hero-art" aria-hidden="true"></div>
    <div class="container hero-content">
      <span class="eyebrow"><span class="live-dot"></span> THE CITY, AFTER DARK</span>
      <h1>把今晚，<br />留给<span>大银幕。</span></h1>
      <p>走出日常，走进另一个世界。<br />在帧港，找到值得出发的那一场。</p>
      <div class="button-row">
        <RouterLink :to="featured ? `/movies/${featured.id}` : '/movies'" class="button"
          >{{ featured ? `走进《${featured.title}》` : '发现好电影'
          }}<Icon name="arrow" :size="18" /></RouterLink
        ><RouterLink to="/cinemas" class="hero-secondary"
          >寻找附近的银幕 <Icon name="chevron" :size="16"
        /></RouterLink>
      </div>
      <div class="hero-caption">
        <span class="caption-line"></span><span>本周光影提案<small>不止是观看，更是一次抵达。</small></span>
      </div>
    </div>
    <div class="hero-bottom container">
      <span>01 / FRAME YOUR NIGHT</span><span>FOR THE LOVE OF CINEMA <Icon name="spark" :size="15" /></span>
    </div>
  </section>
  <div class="container home-body">
    <div class="intro-strip">
      <span class="eyebrow">A GOOD NIGHT STARTS HERE</span><span>选一部电影，给生活按下暂停键。</span
      ><Icon name="film" :size="24" />
    </div>
    <PageState :loading="loading" :error="error" @retry="reload"
      ><template v-if="data">
        <section class="section-block">
          <div class="section-heading">
            <div>
              <span class="eyebrow">NOW SHOWING</span>
              <h2>
                正在发生的好故事<span class="count">{{ data.movies.total }}</span>
              </h2>
            </div>
            <RouterLink to="/movies" class="text-link">全部电影 <Icon name="arrow" :size="18" /></RouterLink>
          </div>
          <div v-if="data.movies.items.length" class="movie-grid home-movies">
            <MovieCard v-for="movie in data.movies.items" :key="movie.id" :movie="movie" />
          </div>
          <div v-else class="empty-state"><p>片单更新中，稍后再来发现新故事。</p></div>
        </section>
        <section class="editorial-banner">
          <div>
            <span class="eyebrow">MAKE IT YOUR KIND OF NIGHT</span>
            <h2>好座位，<br />让好故事再近一点。</h2>
            <p>在线选座 · 8 分钟安心保留 · 票夹随时查看</p>
            <RouterLink to="/movies" class="text-link">安排你的下一场 <Icon name="arrow" /></RouterLink>
          </div>
          <div class="seat-art" aria-hidden="true">
            <span v-for="n in 30" :key="n" :class="{ chosen: [8, 9, 14, 15].includes(n) }"></span>
          </div>
          <span class="editorial-number">FH / 02</span>
        </section>
        <section class="section-block">
          <div class="section-heading">
            <div>
              <span class="eyebrow">CURATED FOR YOU</span>
              <h2>{{ auth.user ? '你的专属光影提案' : '总有一个故事，与你相遇' }}</h2>
            </div>
            <RouterLink to="/account" class="text-link"
              >设置观影偏好 <Icon name="arrow" :size="18"
            /></RouterLink>
          </div>
          <div class="movie-grid four-columns">
            <MovieCard
              v-for="item in data.recommendations"
              :key="item.movie.id"
              :movie="item.movie"
              :reason="item.reason"
            />
          </div>
        </section>
        <section class="section-block">
          <div class="section-heading">
            <div>
              <span class="eyebrow">PLACES TO ESCAPE</span>
              <h2>城市里的光影客厅</h2>
            </div>
            <RouterLink to="/cinemas" class="text-link">探索影院 <Icon name="arrow" :size="18" /></RouterLink>
          </div>
          <div class="cinema-grid">
            <RouterLink
              v-for="(cinema, index) in data.cinemas.slice(0, 3)"
              :key="cinema.id"
              :to="`/cinemas/${cinema.id}`"
              class="cinema-card"
              ><div class="cinema-illustration" :class="`venue-${index}`">
                <div class="cinema-building"><span>FRAMEHARBOR</span><i></i><i></i><i></i></div>
                <span class="cinema-city"
                  >{{ cinema.city }}<small>{{ cinema.district }}</small></span
                >
              </div>
              <div class="cinema-card-content">
                <h3>{{ cinema.name }}</h3>
                <p><Icon name="pin" :size="14" />{{ cinema.address }}</p>
                <div class="cinema-card-bottom">
                  <span class="small muted">{{ cinema.tags.slice(0, 2).join(' / ') }}</span
                  ><span class="price small">{{
                    cinema.fromPriceCents ? `${money(cinema.fromPriceCents)} 起` : '查看影院'
                  }}</span>
                </div>
              </div></RouterLink
            >
          </div>
        </section>
        <section class="coupon-banner">
          <span class="coupon-stamp"><Icon name="ticket" :size="30" /></span>
          <div>
            <span class="eyebrow">YOUR FIRST FRAME</span>
            <h3>第一场相遇，给你一点惊喜。</h3>
            <p>优惠码 <strong>FIRSTFRAME</strong> · 满 ¥60 减 ¥10 · 每人限用一次</p>
          </div>
          <RouterLink to="/movies" class="button secondary"
            >去选一场 <Icon name="arrow" :size="17"
          /></RouterLink>
        </section> </template
    ></PageState>
  </div>
</template>
