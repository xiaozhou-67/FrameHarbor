<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { GENRES, type Movie } from '../../../../shared/domain.ts';
import type { MovieInput } from '../../../../shared/validation.ts';
import { api, messageOf } from '../../api.ts';
import { useResource } from '../../composables/resource.ts';
import { notify } from '../../state.ts';
import { dayKey } from '../../format.ts';
import PageState from '../../components/PageState.vue';
import FormDialog from '../../components/FormDialog.vue';
import Icon from '../../components/Icon.vue';
const { data, loading, error, reload } = useResource((signal) => api<Movie[]>('/admin/movies', { signal }));
const q = ref('');
const items = computed(
  () => data.value?.filter((m) => `${m.title}${m.director}`.includes(q.value.trim())) ?? [],
);
const open = ref(false);
const editing = ref<number | null>(null);
const saving = ref(false);
const formError = ref('');
const castText = ref('');
const defaults = (): MovieInput => ({
  title: '',
  englishTitle: '',
  genre: '剧情',
  durationMinutes: 120,
  language: '国语 / 中文字幕',
  releaseDate: dayKey(Date.now()),
  synopsis: '',
  director: '',
  cast: [],
  poster: '/art/aurora.svg',
  accent: '#7de2cc',
  status: 'soon',
  featured: false,
  editorialScore: 8,
});
const form = reactive<MovieInput>(defaults());
const arts = ['aurora', 'tide', 'orbit', 'forest', 'echo', 'island', 'light', 'moon'];
function edit(movie?: Movie) {
  editing.value = movie?.id ?? null;
  Object.assign(form, movie ?? defaults());
  castText.value = movie?.cast.join('、') ?? '';
  formError.value = '';
  open.value = true;
}
async function save() {
  saving.value = true;
  formError.value = '';
  try {
    const body = {
      ...form,
      cast: castText.value
        .split(/[、,，\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    };
    await api(editing.value ? `/admin/movies/${editing.value}` : '/admin/movies', {
      method: editing.value ? 'PUT' : 'POST',
      body,
    });
    open.value = false;
    notify('影片资料已保存');
    await reload();
  } catch (e) {
    formError.value = messageOf(e);
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <header class="admin-page-heading">
    <div>
      <span class="eyebrow">THE STORIES WE SHARE</span>
      <h1>影片管理</h1>
      <p>编辑片单、维护内容，并选择首页精选影片。</p>
    </div>
    <button class="button small-button" @click="edit()"><Icon name="plus" :size="18" />新增影片</button>
  </header>
  <div class="table-toolbar">
    <label class="search-box"
      ><Icon name="search" :size="18" /><input
        v-model="q"
        placeholder="按片名、导演筛选"
        aria-label="筛选影片" /></label
    ><span class="small muted">{{ items.length }} 部影片</span>
  </div>
  <PageState :loading="loading" :error="error" @retry="reload"
    ><div class="table-scroll panel">
      <table>
        <thead>
          <tr>
            <th>影片</th>
            <th>类型 / 时长</th>
            <th>上映日</th>
            <th>状态</th>
            <th>精选指数 / 用户评分</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="movie in items" :key="movie.id">
            <td>
              <div class="table-movie">
                <img :src="movie.poster" :alt="movie.title" width="40" height="56" />
                <div>
                  <strong>{{ movie.title }}</strong
                  ><small
                    >{{ movie.director }}
                    <span v-if="movie.featured" class="mint-text">· 首页精选</span></small
                  >
                </div>
              </div>
            </td>
            <td>{{ movie.genre }} / {{ movie.durationMinutes }} 分</td>
            <td>{{ movie.releaseDate }}</td>
            <td>
              <span class="badge" :class="movie.status">{{
                { now: '上映中', soon: '即将上映', archived: '已归档' }[movie.status]
              }}</span>
            </td>
            <td>{{ movie.editorialScore.toFixed(1) }} / {{ movie.rating?.toFixed(1) ?? '暂无' }}</td>
            <td><button class="text-button" @click="edit(movie)">编辑</button></td>
          </tr>
          <tr v-if="!items.length">
            <td colspan="6" class="center muted">暂无匹配影片</td>
          </tr>
        </tbody>
      </table>
    </div></PageState
  ><FormDialog :open="open" :title="editing ? '编辑影片' : '新增影片'" :busy="saving" @close="open = false"
    ><form class="editor-form" @submit.prevent="save">
      <div class="form-grid">
        <label>中文片名<input v-model="form.title" required maxlength="60" /></label
        ><label>英文片名<input v-model="form.englishTitle" required maxlength="100" /></label
        ><label
          >类型<select v-model="form.genre">
            <option v-for="g in GENRES" :key="g">{{ g }}</option>
          </select></label
        ><label
          >时长（分钟）<input
            v-model.number="form.durationMinutes"
            type="number"
            min="30"
            max="300"
            required /></label
        ><label>语言<input v-model="form.language" required maxlength="30" /></label
        ><label>上映日期<input v-model="form.releaseDate" type="date" required /></label
        ><label>导演<input v-model="form.director" required maxlength="100" /></label
        ><label>主演（顿号分隔）<input v-model="castText" required maxlength="600" /></label
        ><label
          >状态<select v-model="form.status">
            <option value="soon">即将上映</option>
            <option value="now">正在上映</option>
            <option value="archived">归档下架</option>
          </select></label
        ><label
          >编辑精选指数<input
            v-model.number="form.editorialScore"
            type="number"
            min="0"
            max="10"
            step="0.1"
            required /></label
        ><label
          >本地概念海报<select v-model="form.poster">
            <option v-for="art in arts" :key="art" :value="`/art/${art}.svg`">{{ art }}</option>
          </select></label
        ><label>影片主题色<input v-model="form.accent" type="color" /></label>
      </div>
      <label
        >故事简介<textarea
          v-model="form.synopsis"
          required
          minlength="20"
          maxlength="2000"
          rows="4"
        ></textarea></label
      ><label class="checkbox-label"><input v-model="form.featured" type="checkbox" />设为首页精选</label>
      <p class="small muted">
        存在未结束排片时，请先取消场次，再调整时长或下架状态。概念海报为项目自带的本地资源。
      </p>
      <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
      <div class="dialog-actions">
        <button type="button" class="button secondary" :disabled="saving" @click="open = false">取消</button
        ><button class="button" :disabled="saving">{{ saving ? '保存中…' : '保存影片' }}</button>
      </div>
    </form></FormDialog
  >
</template>
