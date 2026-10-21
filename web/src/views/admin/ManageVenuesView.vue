<script setup lang="ts">
import { reactive, ref } from 'vue';
import type { Cinema, Hall } from '../../../../shared/domain.ts';
import type { CinemaInput, HallInput } from '../../../../shared/validation.ts';
import { api, messageOf } from '../../api.ts';
import { useResource } from '../../composables/resource.ts';
import { notify } from '../../state.ts';
import PageState from '../../components/PageState.vue';
import FormDialog from '../../components/FormDialog.vue';
import Icon from '../../components/Icon.vue';
const { data, loading, error, reload } = useResource(async (signal) => {
  const [cinemas, halls] = await Promise.all([
    api<Cinema[]>('/admin/cinemas', { signal }),
    api<Hall[]>('/admin/halls', { signal }),
  ]);
  return { cinemas, halls };
});
const editor = ref<'cinema' | 'hall' | null>(null);
const editing = ref<number | null>(null);
const saving = ref(false);
const formError = ref('');
const tags = ref('');
const cinema = reactive<CinemaInput>({
  name: '',
  city: '',
  district: '',
  address: '',
  tags: [],
  description: '',
});
const hall = reactive<HallInput>({ cinemaId: 0, name: '', format: '激光 2D', rows: 8, columns: 12 });
function editCinema(c?: Cinema) {
  editing.value = c?.id ?? null;
  Object.assign(cinema, c ?? { name: '', city: '', district: '', address: '', tags: [], description: '' });
  tags.value = c?.tags.join('、') ?? '';
  formError.value = '';
  editor.value = 'cinema';
}
function editHall(h?: Hall) {
  editing.value = h?.id ?? null;
  Object.assign(
    hall,
    h ?? { cinemaId: data.value?.cinemas[0]?.id ?? 0, name: '', format: '激光 2D', rows: 8, columns: 12 },
  );
  formError.value = '';
  editor.value = 'hall';
}
async function save() {
  saving.value = true;
  formError.value = '';
  try {
    const path = editor.value === 'cinema' ? '/admin/cinemas' : '/admin/halls';
    const body =
      editor.value === 'cinema'
        ? {
            ...cinema,
            tags: tags.value
              .split(/[、,，]/)
              .map((s) => s.trim())
              .filter(Boolean),
          }
        : hall;
    await api(editing.value ? `${path}/${editing.value}` : path, {
      method: editing.value ? 'PUT' : 'POST',
      body,
    });
    editor.value = null;
    notify('场地资料已保存');
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
      <span class="eyebrow">PLACES FOR GOOD STORIES</span>
      <h1>影院与影厅</h1>
      <p>维护场地信息与座位布局，为排片准备好空间。</p>
    </div>
    <div class="button-row">
      <button class="button secondary small-button" @click="editCinema()">新增影院</button
      ><button class="button small-button" :disabled="!data?.cinemas.length" @click="editHall()">
        <Icon name="plus" :size="18" />新增影厅
      </button>
    </div>
  </header>
  <PageState :loading="loading" :error="error" @retry="reload"
    ><template v-if="data"
      ><section class="section-block admin-section">
        <h2>
          影院资料 <span class="count">{{ data.cinemas.length }}</span>
        </h2>
        <div class="table-scroll panel">
          <table>
            <thead>
              <tr>
                <th>影院</th>
                <th>城市 / 地区</th>
                <th>地址</th>
                <th>特色</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in data.cinemas" :key="c.id">
                <td>
                  <strong>{{ c.name }}</strong>
                </td>
                <td>{{ c.city }} / {{ c.district }}</td>
                <td>{{ c.address }}</td>
                <td>{{ c.tags.join(' / ') }}</td>
                <td><button class="text-button" @click="editCinema(c)">编辑</button></td>
              </tr>
              <tr v-if="!data.cinemas.length">
                <td colspan="5" class="center muted">请先新增影院</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section class="section-block admin-section">
        <h2>
          影厅布局 <span class="count">{{ data.halls.length }}</span>
        </h2>
        <div class="table-scroll panel">
          <table>
            <thead>
              <tr>
                <th>影厅</th>
                <th>所属影院</th>
                <th>放映格式</th>
                <th>布局</th>
                <th>座位数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in data.halls" :key="h.id">
                <td>
                  <strong>{{ h.name }}</strong>
                </td>
                <td>{{ data.cinemas.find((c) => c.id === h.cinemaId)?.name }}</td>
                <td>{{ h.format }}</td>
                <td>{{ h.rows }} 排 × {{ h.columns }} 座</td>
                <td>{{ h.rows * h.columns }}</td>
                <td><button class="text-button" @click="editHall(h)">编辑</button></td>
              </tr>
              <tr v-if="!data.halls.length">
                <td colspan="6" class="center muted">请新增影厅</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section></template
    ></PageState
  ><FormDialog
    :open="editor !== null"
    :title="`${editing ? '编辑' : '新增'}${editor === 'cinema' ? '影院' : '影厅'}`"
    :busy="saving"
    @close="editor = null"
    ><form class="editor-form" @submit.prevent="save">
      <template v-if="editor === 'cinema'"
        ><label>影院名称<input v-model="cinema.name" required minlength="2" maxlength="60" /></label>
        <div class="form-grid">
          <label>城市<input v-model="cinema.city" required minlength="2" maxlength="30" /></label
          ><label>地区<input v-model="cinema.district" required minlength="2" maxlength="30" /></label>
        </div>
        <label>详细地址<input v-model="cinema.address" required minlength="5" maxlength="150" /></label
        ><label>特色标签（顿号分隔，最多 6 项）<input v-model="tags" maxlength="150" /></label
        ><label
          >影院介绍<textarea
            v-model="cinema.description"
            required
            minlength="10"
            maxlength="500"
            rows="4"
          ></textarea></label></template
      ><template v-else
        ><label
          >所属影院<select v-model.number="hall.cinemaId" required>
            <option v-for="c in data?.cinemas ?? []" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select></label
        >
        <div class="form-grid">
          <label>影厅名称<input v-model="hall.name" required maxlength="30" /></label
          ><label
            >放映格式<select v-model="hall.format">
              <option>激光 2D</option>
              <option>杜比全景声</option>
              <option>IMAX</option>
              <option>CINITY</option>
            </select></label
          ><label>排数<input v-model.number="hall.rows" type="number" min="4" max="15" required /></label
          ><label
            >每排座位数<input v-model.number="hall.columns" type="number" min="6" max="20" required
          /></label>
        </div>
        <p class="small muted">
          共 {{ hall.rows * hall.columns }} 座。已有排片历史的影厅仅可改名，调整布局或格式请新建影厅。
        </p></template
      >
      <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
      <div class="dialog-actions">
        <button type="button" class="button secondary" :disabled="saving" @click="editor = null">取消</button
        ><button class="button" :disabled="saving">{{ saving ? '保存中…' : '保存资料' }}</button>
      </div>
    </form></FormDialog
  >
</template>
